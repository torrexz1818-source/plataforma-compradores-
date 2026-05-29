from __future__ import annotations

import math
import re
from pathlib import Path
from typing import Any

import pandas as pd

from app.config import get_settings
from app.document_processing.docx_reader import read_docx
from app.document_processing.file_detector import detect_file_type
from app.document_processing.image_ocr import read_image
from app.document_processing.pdf_reader import read_pdf

IMPORTANT_TERMS = (
    "precio",
    "monto",
    "total",
    "subtotal",
    "moneda",
    "usd",
    "pen",
    "soles",
    "dolares",
    "dólares",
    "proveedor",
    "ruc",
    "plazo",
    "entrega",
    "vigencia",
    "garantia",
    "garantía",
    "soporte",
    "mantenimiento",
    "operacion",
    "operación",
    "licencia",
    "flete",
    "logistica",
    "logística",
    "instalacion",
    "instalación",
    "exclusion",
    "exclusión",
    "riesgo",
    "penalidad",
    "condiciones",
    "forma de pago",
    "alcance",
    "entregable",
    "criterio",
    "evaluacion",
    "evaluación",
)

SECTION_PATTERNS: dict[str, tuple[str, ...]] = {
    "objetivo_contratacion": ("objetivo", "necesidad", "antecedente"),
    "alcance": ("alcance", "scope", "servicio incluido", "incluye"),
    "requisitos_tecnicos": ("requisito", "especificacion", "especificación", "ficha tecnica", "ficha técnica"),
    "entregables": ("entregable", "producto final", "informe", "documentacion", "documentación"),
    "plazos": ("plazo", "cronograma", "fecha", "entrega", "vigencia"),
    "criterios_evaluacion": ("criterio", "evaluacion", "evaluación", "puntaje", "ponderacion", "ponderación"),
    "condiciones_comerciales": ("precio", "monto", "pago", "moneda", "facturacion", "facturación"),
    "riesgos": ("riesgo", "penalidad", "incumplimiento", "exclusion", "exclusión"),
    "pendientes": ("pendiente", "por confirmar", "por definir", "no incluido", "no incluye"),
}

CANDIDATE_FIELDS: dict[str, tuple[str, ...]] = {
    "dates": ("fecha", "periodo", "mes", "anio", "año", "date"),
    "amounts": ("monto", "importe", "total", "precio", "costo", "valor", "saldo", "amount"),
    "categories": ("categoria", "categoría", "familia", "rubro", "tipo", "category"),
    "suppliers": ("proveedor", "supplier", "vendor", "empresa", "razon", "razón"),
    "areas": ("area", "área", "departamento", "gerencia"),
    "cost_centers": ("centro", "ceco", "cost center", "centro de costo"),
    "buyers": ("comprador", "buyer", "solicitante", "responsable"),
}


def _clean_text(text: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", re.sub(r"[ \t]+", " ", text.replace("\r\n", "\n").replace("\r", "\n"))).strip()


def _line_score(line: str) -> int:
    lowered = line.lower()
    return sum(1 for term in IMPORTANT_TERMS if term in lowered)


def _block(block_id: str, source: str, content: str, section: str = "contenido", extra: dict[str, Any] | None = None) -> dict[str, Any]:
    text = _clean_text(content)
    return {
        "id": block_id,
        "source": source,
        "section": section,
        "content": text,
        "characterCount": len(text),
        **(extra or {}),
    }


def _select_text_blocks(
    text: str,
    *,
    source: str,
    prefix: str,
    budget: int,
    section_hint: str = "contenido",
) -> tuple[list[dict[str, Any]], int, bool, str | None]:
    text = _clean_text(text)
    if not text:
        return [], 0, False, None
    if len(text) <= budget:
        return [_block(f"{prefix}-full", source, text, section_hint, {"strategy": "complete"})], len(text), False, None

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    selected: list[tuple[str, str]] = []
    if budget >= 5000:
        head_floor, tail_floor = 1200, 800
    elif budget >= 1500:
        head_floor, tail_floor = 500, 300
    else:
        head_floor, tail_floor = max(budget // 3, 1), max(budget // 4, 1)
    head_chars = max(math.floor(budget * 0.28), head_floor)
    tail_chars = max(math.floor(budget * 0.18), tail_floor)
    reserved = min(head_chars + tail_chars, max(budget - 200, 1))
    if head_chars + tail_chars > reserved:
        ratio = head_chars / max(head_chars + tail_chars, 1)
        head_chars = max(math.floor(reserved * ratio), 1)
        tail_chars = max(reserved - head_chars, 1)
    middle_budget = max(budget - head_chars - tail_chars, 0)
    selected.append(("inicio", text[:head_chars]))
    important_lines = sorted(
        [line for line in lines if _line_score(line) > 0],
        key=_line_score,
        reverse=True,
    )
    middle_parts: list[str] = []
    used = 0
    for line in important_lines:
        if line in middle_parts:
            continue
        if used + len(line) + 1 > middle_budget:
            break
        middle_parts.append(line)
        used += len(line) + 1
    if middle_parts:
        selected.append(("bloques_relevantes", "\n".join(middle_parts)))
    selected.append(("cierre", text[-tail_chars:]))
    blocks = [
        _block(f"{prefix}-{index + 1}", source, content, section, {"strategy": section})
        for index, (section, content) in enumerate(selected)
        if content.strip()
    ]
    sent = sum(len(item["content"]) for item in blocks)
    return blocks, sent, True, "Se conservaron inicio, cierre y bloques con terminos relevantes; se omitieron fragmentos intermedios."


def _field_matches(column: str, terms: tuple[str, ...]) -> bool:
    normalized = column.lower()
    return any(term in normalized for term in terms)


def _sheet_profile(sheet_name: str, frame: pd.DataFrame, sample_rows: int) -> tuple[dict[str, Any], dict[str, Any]]:
    cleaned = frame.dropna(how="all").dropna(axis=1, how="all").copy()
    cleaned.columns = [str(column).strip() or f"Columna {index + 1}" for index, column in enumerate(cleaned.columns)]
    visible_columns = [str(column) for column in cleaned.columns]
    rows_detected = int(len(cleaned.index))
    numeric_stats: dict[str, Any] = {}
    detected_fields: dict[str, list[str]] = {key: [] for key in CANDIDATE_FIELDS}

    for column in visible_columns:
        for field, terms in CANDIDATE_FIELDS.items():
            if _field_matches(column, terms):
                detected_fields[field].append(column)
        numeric = pd.to_numeric(cleaned[column], errors="coerce")
        if numeric.notna().sum() > 0:
            numeric_stats[column] = {
                "count": int(numeric.notna().sum()),
                "sum": float(numeric.sum()),
                "min": float(numeric.min()),
                "max": float(numeric.max()),
                "mean": float(numeric.mean()),
            }

    if rows_detected <= sample_rows:
        sample = cleaned
        sample_strategy = "complete_sheet"
    else:
        head_count = max(sample_rows // 3, 1)
        tail_count = max(sample_rows // 3, 1)
        middle_count = max(sample_rows - head_count - tail_count, 1)
        middle_start = max((rows_detected // 2) - (middle_count // 2), 0)
        sample = pd.concat(
            [
                cleaned.head(head_count),
                cleaned.iloc[middle_start : middle_start + middle_count],
                cleaned.tail(tail_count),
            ],
            ignore_index=True,
        )
        sample_strategy = "head_middle_tail_sample"

    table = {
        "sheetName": sheet_name,
        "rowsDetected": rows_detected,
        "columnsDetected": visible_columns,
        "columnsCount": len(visible_columns),
        "numericStats": numeric_stats,
        "candidateFields": {key: value for key, value in detected_fields.items() if value},
        "sampleStrategy": sample_strategy,
        "sampleRowsSent": sample.where(pd.notna(sample), None).to_dict(orient="records"),
    }
    profile = {
        "sheetName": sheet_name,
        "rowsDetected": rows_detected,
        "columnsDetected": visible_columns,
        "columnsCount": len(visible_columns),
        "numericStats": numeric_stats,
        "candidateFields": table["candidateFields"],
    }
    return profile, table


def _read_pdf_pages(path: Path) -> list[dict[str, Any]]:
    import fitz

    pages: list[dict[str, Any]] = []
    with fitz.open(path) as document:
        for index, page in enumerate(document, start=1):
            pages.append({"page": index, "text": page.get_text("text")})
    return pages


def _section_blocks(text: str, *, source: str, budget: int) -> tuple[list[dict[str, Any]], int, bool, str | None]:
    lines = [line for line in _clean_text(text).splitlines() if line.strip()]
    sections: dict[str, list[str]] = {key: [] for key in SECTION_PATTERNS}
    sections["contenido_general"] = []
    for line in lines:
        lowered = line.lower()
        matched = False
        for section, terms in SECTION_PATTERNS.items():
            if any(term in lowered for term in terms):
                sections[section].append(line)
                matched = True
        if not matched and len(sections["contenido_general"]) < 80:
            sections["contenido_general"].append(line)

    section_text = "\n\n".join(
        f"{section}:\n" + "\n".join(values[:80])
        for section, values in sections.items()
        if values
    )
    if not section_text:
        section_text = text
    return _select_text_blocks(section_text, source=source, prefix="sections", budget=budget, section_hint="secciones_relevantes")


def build_structured_document_payload(path: Path, filename: str, *, char_budget: int | None = None) -> dict[str, Any]:
    settings = get_settings()
    file_type = detect_file_type(filename)
    file_size = path.stat().st_size if path.exists() else 0
    budget = char_budget or settings.document_model_char_budget
    warnings: list[str] = []
    evidence_blocks: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    pages_detected: int | None = None
    sheets_detected: list[dict[str, Any]] = []
    total_extracted = 0
    was_truncated = False
    truncation_reason: str | None = None
    extraction_status = "success"

    try:
        if file_type == "pdf":
            pages = _read_pdf_pages(path)
            pages_detected = len(pages)
            per_page_budget = max(budget // max(len(pages), 1), 1)
            for page in pages:
                page_text = _clean_text(str(page.get("text") or ""))
                total_extracted += len(page_text)
                blocks, _, truncated, reason = _select_text_blocks(
                    page_text,
                    source=f"{filename} pagina {page['page']}",
                    prefix=f"pdf-p{page['page']}",
                    budget=per_page_budget,
                    section_hint="pagina_pdf",
                )
                evidence_blocks.extend(blocks)
                was_truncated = was_truncated or truncated
                truncation_reason = truncation_reason or reason
            if total_extracted < 120:
                warnings.append("El PDF tiene poco texto seleccionable; puede requerir OCR o revision manual.")
        elif file_type == "xlsx":
            workbook = pd.read_excel(path, sheet_name=None, dtype=str)
            remaining = budget
            for sheet_name, frame in workbook.items():
                profile, table = _sheet_profile(str(sheet_name), frame, settings.table_sample_rows)
                sheets_detected.append(profile)
                tables.append(table)
                table_text = pd.DataFrame(table["sampleRowsSent"]).to_csv(index=False)
                table_summary = (
                    f"Hoja: {sheet_name}\n"
                    f"Filas detectadas: {profile['rowsDetected']}\n"
                    f"Columnas detectadas: {', '.join(profile['columnsDetected'])}\n"
                    f"Campos candidatos: {profile['candidateFields']}\n"
                    f"Muestra usada: {table['sampleStrategy']}\n{table_text}"
                )
                total_extracted += len(frame.fillna("").to_csv(index=False))
                blocks, sent, truncated, reason = _select_text_blocks(
                    table_summary,
                    source=f"{filename} hoja {sheet_name}",
                    prefix=f"xlsx-{len(sheets_detected)}",
                    budget=max(min(remaining, max(budget // max(len(workbook), 1), 1)), 1),
                    section_hint="hoja_excel",
                )
                evidence_blocks.extend(blocks)
                remaining = max(remaining - sent, 0)
                was_truncated = was_truncated or truncated or profile["rowsDetected"] > len(table["sampleRowsSent"])
                if profile["rowsDetected"] > len(table["sampleRowsSent"]):
                    warnings.append(f"La hoja {sheet_name} se envio como muestra {table['sampleStrategy']}.")
                    truncation_reason = truncation_reason or "Se envio inventario completo de hojas y muestra representativa, no todas las filas."
        elif file_type == "csv":
            frame = pd.read_csv(path, dtype=str)
            profile, table = _sheet_profile("CSV", frame, settings.table_sample_rows)
            sheets_detected.append(profile)
            tables.append(table)
            total_extracted = len(frame.fillna("").to_csv(index=False))
            table_text = pd.DataFrame(table["sampleRowsSent"]).to_csv(index=False)
            blocks, _, was_truncated, truncation_reason = _select_text_blocks(
                f"Archivo CSV\nColumnas detectadas: {', '.join(profile['columnsDetected'])}\n{table_text}",
                source=filename,
                prefix="csv",
                budget=budget,
                section_hint="tabla_csv",
            )
            evidence_blocks.extend(blocks)
            if profile["rowsDetected"] > len(table["sampleRowsSent"]):
                warnings.append(f"El CSV se envio como muestra {table['sampleStrategy']}.")
                was_truncated = True
                truncation_reason = truncation_reason or "Se envio inventario completo y muestra representativa, no todas las filas."
        elif file_type == "docx":
            text = read_docx(path)
            total_extracted = len(text)
            evidence_blocks, _, was_truncated, truncation_reason = _section_blocks(text, source=filename, budget=budget)
        elif file_type in {"jpg", "jpeg", "png"}:
            text, image_warnings = read_image(path)
            warnings.extend(image_warnings)
            total_extracted = len(text)
            evidence_blocks, _, was_truncated, truncation_reason = _section_blocks(text, source=filename, budget=budget)
            if not text.strip():
                extraction_status = "partial"
        else:
            text, file_warnings = read_pdf(path) if file_type == "pdf" else ("", [f"Formato no soportado: {file_type}"])
            warnings.extend(file_warnings)
            total_extracted = len(text)
            evidence_blocks, _, was_truncated, truncation_reason = _section_blocks(text, source=filename, budget=budget)
    except Exception as exc:
        extraction_status = "failed"
        warnings.append(f"No se pudo estructurar el archivo: {exc.__class__.__name__}.")

    sent = sum(int(block.get("characterCount") or 0) for block in evidence_blocks)
    if total_extracted and sent < total_extracted:
        was_truncated = True
        truncation_reason = truncation_reason or "Se envio una seleccion trazable por limites de seguridad."

    public_warnings = []
    if was_truncated:
        public_warnings.append("El archivo fue analizado con una seleccion representativa por su extension.")
    if extraction_status != "success":
        public_warnings.append("La lectura del archivo fue parcial; conviene validar el documento fuente.")

    columns_detected = sorted(
        {
            column
            for sheet in sheets_detected
            for column in sheet.get("columnsDetected", [])
        }
    )
    rows_detected = sum(int(sheet.get("rowsDetected") or 0) for sheet in sheets_detected)

    return {
        "fileName": filename,
        "fileType": file_type,
        "fileSize": file_size,
        "extractionStatus": extraction_status,
        "totalCharactersExtracted": total_extracted,
        "totalCharactersSentToModel": sent,
        "wasTruncated": was_truncated,
        "truncationReason": truncation_reason,
        "pagesDetected": pages_detected,
        "sheetsDetected": sheets_detected,
        "columnsDetected": columns_detected,
        "rowsDetected": rows_detected,
        "evidenceBlocks": evidence_blocks,
        "tables": tables,
        "warnings": warnings,
        "publicWarnings": public_warnings,
    }


def build_public_document_warning(trace: dict[str, Any]) -> list[str]:
    return [str(item) for item in trace.get("publicWarnings", []) if item]


def evidence_text(trace: dict[str, Any], max_blocks: int = 16) -> str:
    parts = []
    for block in trace.get("evidenceBlocks", [])[:max_blocks]:
        parts.append(
            f"[{block.get('source')} | {block.get('section')} | {block.get('strategy', 'seleccion')}] "
            f"{block.get('content')}"
        )
    return "\n\n".join(parts)
