from pathlib import Path

from fastapi import HTTPException

from app.agents.terms_of_reference.schemas import SupportingDocumentSummary
from app.document_processing.file_detector import detect_file_type
from app.document_processing.structured_document import build_public_document_warning, build_structured_document_payload

TERMS_SECTION_KEYS = [
    "objetivo_contratacion",
    "alcance",
    "requisitos_tecnicos",
    "entregables",
    "plazos",
    "criterios_evaluacion",
    "condiciones_comerciales",
    "riesgos",
    "pendientes",
]


def _section_status(trace: dict, section: str) -> dict:
    blocks = [
        block
        for block in trace.get("evidenceBlocks", [])
        if section in str(block.get("section", "")) or section in str(block.get("content", "")).lower()
    ]
    return {
        "section": section,
        "status": "found" if blocks else "not_found",
        "evidence": blocks[:3],
        "note": "No se detecto una seccion explicita; validar si aplica al requerimiento." if not blocks else None,
    }


def extract_supporting_document(path: Path, filename: str) -> tuple[dict, SupportingDocumentSummary]:
    file_type = detect_file_type(filename)
    warnings: list[str] = []

    try:
        trace = build_structured_document_payload(path, filename)
        file_type = str(trace.get("fileType") or file_type)
        warnings = [*trace.get("warnings", []), *build_public_document_warning(trace)]
    except HTTPException:
        raise
    except Exception:
        trace = {
            "fileName": filename,
            "fileType": file_type,
            "evidenceBlocks": [],
            "tables": [],
            "warnings": ["No se pudo leer correctamente el archivo. El proceso continuara sin detenerse."],
            "publicWarnings": ["La lectura del archivo fue parcial; conviene validar el documento fuente."],
            "extractionStatus": "failed",
            "totalCharactersExtracted": 0,
            "totalCharactersSentToModel": 0,
            "wasTruncated": False,
            "truncationReason": None,
            "pagesDetected": None,
            "sheetsDetected": [],
            "columnsDetected": [],
            "rowsDetected": 0,
        }
        warnings = trace["warnings"] + trace["publicWarnings"]

    context = {
        "file_name": filename,
        "detected_type": file_type,
        "extraction_status": trace.get("extractionStatus"),
        "total_characters_extracted": trace.get("totalCharactersExtracted"),
        "total_characters_sent_to_model": trace.get("totalCharactersSentToModel"),
        "was_truncated": trace.get("wasTruncated"),
        "truncation_reason": trace.get("truncationReason"),
        "pages_detected": trace.get("pagesDetected"),
        "sheets_detected": trace.get("sheetsDetected"),
        "columns_detected": trace.get("columnsDetected"),
        "rows_detected": trace.get("rowsDetected"),
        "sections": [_section_status(trace, section) for section in TERMS_SECTION_KEYS],
        "evidence_blocks": trace.get("evidenceBlocks", []),
        "tables": trace.get("tables", []),
        "limitations": warnings,
    }
    summary = SupportingDocumentSummary(
        file_name=filename,
        detected_type=file_type,
        relevant_findings=[
            f"{block.get('section')}: {str(block.get('content', ''))[:220]}"
            for block in trace.get("evidenceBlocks", [])[:4]
        ],
        limitations=warnings,
    )
    return context, summary


def split_lines(value: str | None) -> list[str]:
    if not value:
        return []
    raw_items = value.replace(";", "\n").splitlines()
    return [item.strip(" -\t") for item in raw_items if item.strip(" -\t")]
