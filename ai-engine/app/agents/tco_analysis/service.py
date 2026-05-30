from __future__ import annotations

import base64
import asyncio
import json
import logging
import mimetypes
import re
import time
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile

from app.agents.tco_analysis.prompts import SYSTEM_PROMPT, build_user_prompt
from app.agents.tco_analysis.quality_validator import validate_alternatives, validate_required_fields
from app.agents.tco_analysis.schemas import SupportingDocumentSummary, TcoAnalysisResult
from app.agents.tco_analysis.sensitivity import build_sensitivity_from_totals
from app.ai.llm_client import generate_agent_response
from app.config import get_settings
from app.document_processing.document_reader import read_document_text
from app.document_processing.file_detector import detect_file_type, validate_allowed_file
from app.document_processing.structured_document import build_public_document_warning, build_structured_document_payload
from app.utils.temp_files import cleanup_files, save_upload_temporarily

logger = logging.getLogger(__name__)

MAX_DOCUMENT_CONTEXT_CHARS = 20000
MAX_TOTAL_DOCUMENT_CONTEXT_CHARS = 90000
IMAGE_FILE_TYPES = {"jpg", "jpeg", "png"}
PRELIMINARY_MISSING_INFO_NOTE = (
    "Con la informacion disponible se puede realizar este analisis preliminar. "
    "Para mejorar la precision del TCO, seria recomendable contar con los siguientes datos..."
)
DEFAULT_MISSING_INFORMATION = [
    "Mantenimiento anual",
    "Vida util",
    "Repuestos",
    "Garantia",
    "Costos logisticos",
    "Instalacion",
    "Consumo energetico",
    "Soporte",
    "Valor residual",
    "Tipo de cambio e impuestos/aranceles si aplica",
]
DEFAULT_SUPPLIER_QUESTIONS = [
    "El precio incluye instalacion?",
    "Cual es la vida util estimada?",
    "Que garantia aplica?",
    "Cual es el costo anual de mantenimiento?",
    "Hay repuestos disponibles localmente?",
    "El flete esta incluido?",
    "Que costos no estan incluidos?",
]
FINANCIAL_MODEL_FIELDS = [
    "acquisition_costs",
    "logistics_costs",
    "implementation_costs",
    "operating_costs",
    "maintenance_costs",
    "support_costs",
    "insurance_costs",
    "financing_costs",
    "administrative_costs",
    "risk_costs",
    "exit_costs",
    "residual_value",
    "net_tco",
    "annualized_tco",
    "unit_tco",
    "usage_tco",
]
FINANCIAL_COMPONENT_KEYWORDS = {
    "acquisition_costs": ("precio", "compra", "adquisicion", "inversion", "licencia", "honorario"),
    "logistics_costs": ("flete", "logistica", "transporte", "aduana", "arancel", "nacionalizacion", "almacenamiento"),
    "implementation_costs": ("implementacion", "instalacion", "configuracion", "integracion", "migracion", "capacitacion"),
    "operating_costs": ("operacion", "energia", "combustible", "insumo", "renovacion", "suscripcion"),
    "maintenance_costs": ("manten", "correctivo", "preventivo", "repuesto"),
    "support_costs": ("soporte", "sla", "postventa", "garantia"),
    "insurance_costs": ("seguro", "soat", "siniestralidad"),
    "financing_costs": ("financ", "interes", "credito"),
    "administrative_costs": ("administr", "gestion", "supervision"),
    "risk_costs": ("riesgo", "penalidad", "parada", "incumplimiento", "obsolescencia", "merma"),
    "exit_costs": ("salida", "reemplazo", "terminacion"),
    "residual_value": ("residual", "recuperable", "depreciacion"),
}
SCORECARD_PROFILES = {
    "flota": [
        ("initial_investment", "Inversion inicial", 20, "acquisition_costs", "cost", ("precio", "inversion", "adquisicion")),
        ("net_tco", "TCO neto total", 25, "net_tco", "cost", ("tco", "total")),
        ("operation_consumption", "Consumo / operacion", 15, "operating_costs", "cost", ("consumo", "operacion", "combustible")),
        ("warranty", "Garantia", 10, None, "benefit", ("garantia", "warranty")),
        ("support_network", "Red de talleres / soporte", 10, "support_costs", "benefit", ("taller", "soporte", "postventa")),
        ("residual_value", "Valor residual / depreciacion", 10, "residual_value", "benefit", ("residual", "depreciacion")),
        ("operational_risk", "Riesgo operativo y mantenimiento", 10, "risk_costs", "risk", ("riesgo", "mantenimiento")),
    ],
    "software": [
        ("net_tco", "TCO neto total", 25, "net_tco", "cost", ("tco", "total")),
        ("implementation", "Implementacion", 15, "implementation_costs", "cost", ("implementacion", "configuracion")),
        ("support", "Soporte", 15, "support_costs", "benefit", ("soporte", "sla")),
        ("integration_scalability", "Integracion / escalabilidad", 15, None, "benefit", ("integracion", "erp", "escalabilidad")),
        ("contract_risk", "Riesgo contractual", 10, "risk_costs", "risk", ("riesgo", "contrato", "salida")),
        ("cost_per_user", "Costo por usuario", 10, "unit_tco", "cost", ("usuario", "unitario")),
        ("adoption_time", "Tiempo de adopcion", 10, None, "benefit", ("adopcion", "capacitacion", "implementacion")),
    ],
    "servicios": [
        ("contract_tco", "TCO total del contrato", 25, "net_tco", "cost", ("tco", "contrato", "honorario")),
        ("scope", "Alcance", 20, None, "benefit", ("alcance", "servicio")),
        ("sla", "SLA", 15, None, "benefit", ("sla", "tiempo", "respuesta")),
        ("provider_capacity", "Experiencia / capacidad del proveedor", 15, None, "benefit", ("experiencia", "equipo", "capacidad")),
        ("noncompliance_risk", "Riesgo de incumplimiento", 10, "risk_costs", "risk", ("riesgo", "incumplimiento")),
        ("continuity_support", "Soporte / continuidad", 10, "support_costs", "benefit", ("soporte", "continuidad")),
        ("penalties_guarantees", "Penalidades / garantias", 5, None, "benefit", ("penalidad", "garantia")),
    ],
    "importacion": [
        ("landed_tco", "TCO puesto en destino", 30, "net_tco", "cost", ("tco", "destino", "nacionalizacion")),
        ("lead_time", "Lead time", 15, None, "cost", ("lead time", "plazo", "entrega")),
        ("logistics_risk", "Riesgo logistico", 15, "risk_costs", "risk", ("riesgo logistico", "flete", "aduana")),
        ("local_support", "Soporte local / garantia", 15, "support_costs", "benefit", ("soporte", "garantia")),
        ("fx_risk", "Riesgo cambiario", 10, None, "risk", ("tipo de cambio", "cambiario")),
        ("supply_flexibility", "Flexibilidad de abastecimiento", 10, None, "benefit", ("flexibilidad", "stock", "abastecimiento")),
        ("tax_customs_risk", "Riesgo tributario / aduanero", 5, None, "risk", ("arancel", "impuesto", "aduana")),
    ],
    "maquinaria": [
        ("net_tco", "TCO neto total", 25, "net_tco", "cost", ("tco", "total")),
        ("productivity", "Productividad", 20, None, "benefit", ("productividad", "produccion")),
        ("maintenance", "Mantenimiento", 15, "maintenance_costs", "cost", ("mantenimiento", "correctivo", "preventivo")),
        ("useful_life", "Vida util", 15, None, "benefit", ("vida util", "vida")),
        ("spares_support", "Repuestos / soporte", 10, "support_costs", "benefit", ("repuesto", "soporte")),
        ("energy_operation", "Energia / operacion", 10, "operating_costs", "cost", ("energia", "operacion")),
        ("residual_value", "Valor residual", 5, "residual_value", "benefit", ("residual",)),
    ],
    "repuestos": [
        ("supply_total_cost", "Costo total de abastecimiento", 25, "net_tco", "cost", ("costo", "abastecimiento", "tco")),
        ("quality_spec", "Calidad / especificacion", 20, None, "benefit", ("calidad", "especificacion")),
        ("lead_time", "Lead time", 15, None, "cost", ("lead time", "plazo", "entrega")),
        ("supply_risk", "Riesgo de abastecimiento", 15, "risk_costs", "risk", ("riesgo", "abastecimiento")),
        ("logistics_storage", "Costo logistico / almacenamiento", 10, "logistics_costs", "cost", ("logistica", "almacenamiento", "flete")),
        ("waste_obsolescence", "Merma / obsolescencia", 10, "risk_costs", "risk", ("merma", "obsolescencia")),
        ("supplier_flexibility", "Flexibilidad del proveedor", 5, None, "benefit", ("flexibilidad", "proveedor")),
    ],
}
RELEVANT_TERMS = (
    "precio", "fob", "cif", "exw", "flete", "seguro", "aduana", "impuesto", "arancel",
    "garantia", "warranty", "mantenimiento", "repuesto", "instalacion", "capacitacion",
    "soporte", "vida util", "lead time", "plazo", "pago", "condiciones", "exclusiones",
    "riesgo", "consumo", "energia", "transporte", "penalidad", "contrato", "licencia",
    "suscripcion", "servicio", "modelo", "marca", "cantidad", "total", "moneda",
)


def parse_alternatives_json(alternatives_json: str | None) -> list[dict[str, Any]]:
    if not alternatives_json or not alternatives_json.strip():
        return []
    try:
        parsed = json.loads(alternatives_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="alternatives_json no es JSON valido.") from exc
    return validate_alternatives(parsed)


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _as_text(value: Any, default: str = "No especificado") -> str:
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        text = json.dumps(value, ensure_ascii=False, default=str)
    else:
        text = str(value)
    return text.strip() or default


def _as_number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text or text.lower() in {"no especificado", "n/a", "na", "null", "none"}:
        return None
    normalized = (
        text.replace("S/", "")
        .replace("$", "")
        .replace("USD", "")
        .replace("PEN", "")
        .replace("EUR", "")
        .replace(",", "")
        .strip()
    )
    try:
        return float(normalized)
    except ValueError:
        return None


def _normalize_level(value: Any, default: str = "medium") -> str:
    text = str(value or "").strip().lower()
    if text in {"low", "bajo", "baja"}:
        return "low"
    if text in {"medium", "medio", "media", "moderado", "moderada"}:
        return "medium"
    if text in {"high", "alto", "alta", "critico", "critica"}:
        return "high"
    return default


def _normalize_spanish_confidence(value: Any, default: str = "baja") -> str:
    text = str(value or "").strip().lower()
    if text in {"alta", "alto", "high"}:
        return "alta"
    if text in {"media", "medio", "medium", "moderada", "moderado"}:
        return "media"
    if text in {"baja", "bajo", "low"}:
        return "baja"
    return default


def _normalize_data_type(value: Any, default: str = "faltante") -> str:
    text = str(value or "").strip().lower()
    aliases = {
        "document": "documento",
        "documental": "documento",
        "user": "usuario",
        "calculated": "calculado",
        "estimate": "estimado",
        "estimated": "estimado",
        "missing": "faltante",
        "not_applicable": "no_aplica",
        "no aplica": "no_aplica",
    }
    normalized = aliases.get(text, text)
    return normalized if normalized in {"documento", "usuario", "calculado", "estimado", "faltante", "no_aplica"} else default


def _normalize_source_type(value: Any, default: str = "estimado") -> str:
    text = str(value or "").strip().lower()
    return text if text in {"benchmark", "estimado", "usuario", "documento"} else default


def _infer_horizon_years(value: Any) -> float | str:
    number = _as_number(value)
    if number is not None:
        return number
    text = str(value or "").lower()
    if "por compra" in text:
        return "Por compra"
    if "vida" in text:
        return "Vida util"
    if "mensual" in text or "mes" in text:
        return 1 / 12
    import re

    match = re.search(r"(\d+(?:[.,]\d+)?)", text)
    if match:
        parsed = _as_number(match.group(1))
        if parsed is not None:
            return parsed
    return "Dato faltante"


def _value_or_status(value: Any, context: str = "") -> float | str:
    number = _as_number(value)
    if number is not None:
        return number
    text = _as_text(value, "")
    if text:
        if text.strip().lower() in {"no especificado", "no determinado", "n/a", "na", "null", "none"}:
            return "Dato faltante"
        return text
    lowered = context.lower()
    if "tco" in lowered or "unit" in lowered or "usage" in lowered:
        return "No calculable con datos actuales"
    return "Dato faltante"


def _alternative_names(result: dict[str, Any]) -> list[str]:
    names: list[str] = []
    matrix = result.get("tco_dashboard_matrix") if isinstance(result.get("tco_dashboard_matrix"), dict) else {}
    alias_to_label: dict[str, str] = {}
    for item in _as_list(matrix.get("alternatives") if isinstance(matrix, dict) else []):
        if not isinstance(item, dict):
            continue
        label = _as_text(item.get("label") or item.get("name") or item.get("provider"), "")
        if not label:
            continue
        names.append(label)
        for alias in [item.get("id"), item.get("label"), item.get("name"), item.get("provider")]:
            alias_text = _as_text(alias, "")
            if alias_text:
                alias_to_label[_normalized_label(alias_text)] = label
    for collection, key in [
        ("tco_totals", "alternative"),
        ("ranking", "alternative"),
        ("data_used", "alternative"),
        ("detected_alternatives", "supplier_name"),
    ]:
        for item in _as_list(result.get(collection)):
            if isinstance(item, dict):
                name = _as_text(item.get(key), "")
                if name:
                    names.append(name)
    for row in _as_list(result.get("tco_matrix")):
        if isinstance(row, dict) and isinstance(row.get("values"), dict):
            for key in row["values"].keys():
                key_text = str(key).strip()
                if not key_text:
                    continue
                names.append(alias_to_label.get(_normalized_label(key_text), key_text))
    return _canonical_alternative_names(names)


def _normalized_label(value: Any) -> str:
    text = _as_text(value, "").lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def _is_internal_alternative_label(value: Any) -> bool:
    normalized = _normalized_label(value)
    return bool(re.fullmatch(r"a\d+|alt\s*\d+|internalid|id interno|rows|sections|values", normalized))


def _canonical_alternative_names(names: list[str]) -> list[str]:
    clean = [_as_text(name, "") for name in names if _as_text(name, "")]
    canonical: list[str] = []
    for name in clean:
        if _is_internal_alternative_label(name):
            continue
        normalized = _normalized_label(name)
        longer = sorted(
            [
                candidate
                for candidate in clean
                if candidate != name
                and not _is_internal_alternative_label(candidate)
                and normalized
                and normalized in _normalized_label(candidate)
            ],
            key=len,
            reverse=True,
        )
        canonical.append(longer[0] if longer else name)
    return list(dict.fromkeys(canonical))


def _financial_category(component: str) -> str | None:
    text = component.lower()
    for field, keywords in FINANCIAL_COMPONENT_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            return field
    return None


def _safe_add(value: float | None, addend: float | None) -> float | None:
    if addend is None:
        return value
    return (value or 0) + addend


def _score_level(score: float | None) -> str:
    value = score or 0
    if value >= 90:
        return "Excelente"
    if value >= 80:
        return "Muy buena"
    if value >= 70:
        return "Buena"
    if value >= 60:
        return "Aceptable con reservas"
    return "Riesgosa / requiere revision"


def _scorecard_profile_key(analysis_type: Any) -> str:
    text = _as_text(analysis_type, "").lower()
    if any(term in text for term in ["flota", "vehiculo", "vehicular", "camioneta"]):
        return "flota"
    if any(term in text for term in ["software", "saas", "licencia"]):
        return "software"
    if any(term in text for term in ["servicio", "mantenimiento industrial"]):
        return "servicios"
    if any(term in text for term in ["importacion", "importación", "china", "local"]):
        return "importacion"
    if any(term in text for term in ["maquinaria", "equipo", "activo"]):
        return "maquinaria"
    if any(term in text for term in ["repuesto", "insumo"]):
        return "repuestos"
    return "maquinaria"


def _confidence_rank(value: str) -> int:
    return {"baja": 0, "media": 1, "alta": 2}.get(value, 0)


def _combined_confidence(values: list[str]) -> str:
    if not values:
        return "baja"
    average = sum(_confidence_rank(value) for value in values) / len(values)
    if average >= 1.65:
        return "alta"
    if average >= 0.75:
        return "media"
    return "baja"


def _find_transparency_evidence(result: dict[str, Any], alternative: str, keywords: tuple[str, ...]) -> dict[str, Any] | None:
    best: dict[str, Any] | None = None
    best_rank = -1
    for item in _as_list(result.get("transparency_table")):
        if not isinstance(item, dict):
            continue
        item_alt = _as_text(item.get("alternative"), "")
        if item_alt not in {alternative, "General"}:
            continue
        field_text = f"{_as_text(item.get('field'), '')} {_as_text(item.get('observation'), '')}".lower()
        if not any(keyword in field_text for keyword in keywords):
            continue
        rank = _confidence_rank(_normalize_spanish_confidence(item.get("confidence_level")))
        if rank > best_rank:
            best = item
            best_rank = rank
    return best


def _risk_penalty(result: dict[str, Any], alternative: str, keywords: tuple[str, ...]) -> tuple[float, str]:
    relevant = []
    for item in _as_list(result.get("risk_analysis")):
        if not isinstance(item, dict):
            continue
        item_alt = _as_text(item.get("alternative"), "General")
        if item_alt not in {alternative, "General"}:
            continue
        text = f"{_as_text(item.get('risk'), '')} {_as_text(item.get('mitigation'), '')}".lower()
        if keywords and not any(keyword in text for keyword in keywords):
            continue
        relevant.append(_normalize_level(item.get("level")))
    if not relevant:
        return 70, "Sin riesgo especifico documentado; puntaje preliminar."
    if "high" in relevant:
        return 45, "Riesgo alto documentado o identificado."
    if "medium" in relevant:
        return 65, "Riesgo medio identificado."
    return 85, "Riesgo bajo identificado."


def _cost_scores(values: dict[str, float | None], lower_is_better: bool = True) -> dict[str, float]:
    numeric = {key: value for key, value in values.items() if value is not None}
    if not numeric:
        return {key: 55 for key in values}
    min_value = min(numeric.values())
    max_value = max(numeric.values())
    if min_value == max_value:
        return {key: 85 if values[key] is not None else 55 for key in values}
    scores: dict[str, float] = {}
    for key, value in values.items():
        if value is None:
            scores[key] = 55
            continue
        if lower_is_better:
            scores[key] = 65 + ((max_value - value) / (max_value - min_value)) * 30
        else:
            scores[key] = 65 + ((value - min_value) / (max_value - min_value)) * 30
    return scores


def _scorecard_source_from_type(value: Any) -> str:
    if str(value or "").strip().lower() == "benchmark":
        return "benchmark"
    data_type = _normalize_data_type(value)
    if data_type == "estimado":
        return "estimado"
    if data_type == "faltante":
        return "faltante"
    return data_type if data_type in {"documento", "usuario", "calculado"} else "faltante"


def _qualitative_benefit_score(value: Any, confidence: str) -> float:
    text = _as_text(value, "").lower()
    if not text or text in {"dato faltante", "no especificado", "no determinado"}:
        return 55
    if any(term in text for term in ["24/7", "premium", "incluid", "mejor", "extendida", "local", "penalidad", "24h"]):
        return 95 if confidence in {"alta", "media"} else 82
    if any(term in text for term in ["48h", "limitad", "parcial", "basico", "básico"]):
        return 58
    return 78 if confidence == "alta" else 72 if confidence == "media" else 62


def _has_numeric_evidence_for_alternative(result: dict[str, Any], alternative: str) -> bool:
    if not alternative:
        return False

    for total in _as_list(result.get("tco_totals")):
        if not isinstance(total, dict):
            continue
        if _as_text(total.get("alternative") or total.get("supplier_name"), "") != alternative:
            continue
        for key in ["initial_price", "total_tco", "tco_per_unit", "tco_monthly", "tco_annual"]:
            value = _as_number(total.get(key))
            if value is not None and value != 0:
                return True

    for row in _as_list(result.get("tco_matrix")):
        if not isinstance(row, dict) or not isinstance(row.get("values"), dict):
            continue
        value = _as_number(row["values"].get(alternative))
        if value is not None and value != 0:
            return True

    for item in _as_list(result.get("data_used")):
        if not isinstance(item, dict):
            continue
        if _as_text(item.get("alternative") or item.get("supplier_name"), "") != alternative:
            continue
        value = _as_number(item.get("base_price"))
        if value is not None and value != 0:
            return True

    return False


def compact_text_for_tco(text: str) -> tuple[str, list[str]]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    relevant = [line for line in lines if any(term in line.lower() for term in RELEVANT_TERMS)]
    selected = relevant[:220] if relevant else lines[:220]
    compact = "\n".join(selected)
    limitations: list[str] = []

    if len(text) > len(compact):
        limitations.append("Se uso un contexto documental priorizado por terminos relevantes para TCO.")
    if len(compact) > MAX_DOCUMENT_CONTEXT_CHARS:
        compact = compact[:MAX_DOCUMENT_CONTEXT_CHARS]
        limitations.append("El contexto documental fue truncado para proteger rendimiento y privacidad.")

    return compact, limitations


def build_document_summary(path: Path, filename: str) -> dict[str, Any]:
    try:
        trace = build_structured_document_payload(path, filename, char_budget=MAX_DOCUMENT_CONTEXT_CHARS)
    except Exception:
        trace = {
            "fileName": filename,
            "fileType": detect_file_type(filename),
            "fileSize": path.stat().st_size if path.exists() else 0,
            "extractionStatus": "failed",
            "totalCharactersExtracted": 0,
            "totalCharactersSentToModel": 0,
            "wasTruncated": False,
            "truncationReason": None,
            "pagesDetected": None,
            "sheetsDetected": [],
            "columnsDetected": [],
            "rowsDetected": 0,
            "evidenceBlocks": [],
            "tables": [],
            "warnings": ["No se pudo extraer texto del archivo; se enviaron metadatos y, si aplica, la imagen al analisis."],
            "publicWarnings": ["La lectura del archivo fue parcial; conviene validar el documento fuente."],
        }

    findings = [
        f"{block.get('source')} | {block.get('section')}: {str(block.get('content', ''))[:1600]}"
        for block in trace.get("evidenceBlocks", [])[:18]
    ]
    limitations = [*trace.get("warnings", []), *build_public_document_warning(trace)]
    return {
        "file_name": filename,
        "detected_type": trace.get("fileType") or detect_file_type(filename),
        "file_size": trace.get("fileSize"),
        "extraction_status": trace.get("extractionStatus"),
        "total_characters_extracted": trace.get("totalCharactersExtracted"),
        "total_characters_sent_to_model": trace.get("totalCharactersSentToModel"),
        "was_truncated": trace.get("wasTruncated"),
        "truncation_reason": trace.get("truncationReason"),
        "pages_detected": trace.get("pagesDetected"),
        "sheets_detected": trace.get("sheetsDetected"),
        "columns_detected": trace.get("columnsDetected"),
        "rows_detected": trace.get("rowsDetected"),
        "relevant_findings": findings,
        "tables": trace.get("tables", []),
        "evidence_blocks": trace.get("evidenceBlocks", []),
        "limitations": limitations,
        "alternative_extraction_contract": {
            "supplier_or_alternative": "extraer si existe",
            "initial_cost": "costo inicial o precio base",
            "operation": "costos de operacion si existen",
            "maintenance": "costos de mantenimiento si existen",
            "implementation": "implementacion o instalacion si existe",
            "logistics": "flete, transporte, aduanas o seguros si existen",
            "support": "soporte, SLA o postventa si existe",
            "licenses": "licencias o suscripciones si existen",
            "risks": "riesgos y penalidades",
            "exclusions": "exclusiones o no incluidos",
            "horizon": "horizonte del analisis",
            "commercial_terms": "forma de pago, vigencia, garantia",
            "currency": "moneda",
            "source": "archivo, pagina, hoja, tabla o bloque",
        },
    }


def trim_total_document_context(documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    remaining = MAX_TOTAL_DOCUMENT_CONTEXT_CHARS
    trimmed: list[dict[str, Any]] = []

    for document in documents:
        next_document = {**document}
        findings: list[str] = []
        for finding in _as_list(next_document.get("relevant_findings")):
            text = str(finding)
            if remaining <= 0:
                break
            if len(text) > remaining:
                findings.append(text[:remaining])
                remaining = 0
            else:
                findings.append(text)
                remaining -= len(text)

        if not findings and next_document.get("relevant_findings"):
            next_document["limitations"] = [
                *_as_list(next_document.get("limitations")),
                "El contexto textual total fue truncado para mantener el analisis dentro del limite operativo.",
            ]
        next_document["relevant_findings"] = findings
        trimmed.append(next_document)

    return trimmed


def build_detected_alternatives_from_documents(documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    detected: list[dict[str, Any]] = []
    for document in documents:
        findings = "\n".join(str(item) for item in _as_list(document.get("relevant_findings")))
        lowered = findings.lower()
        data_detected = [
            label
            for label, terms in {
                "precio": ["precio", "total", "monto", "usd", "pen", "eur"],
                "garantia": ["garantia", "warranty"],
                "lead time": ["lead time", "plazo", "entrega"],
                "forma de pago": ["pago", "credito", "adelanto"],
                "costos logisticos": ["flete", "transporte", "seguro", "aduana", "arancel"],
                "mantenimiento/soporte": ["mantenimiento", "soporte", "repuestos"],
            }.items()
            if any(term in lowered for term in terms)
        ]
        detected.append(
            {
                "supplier_name": f"Proveedor detectado en {document.get('file_name', 'documento')}",
                "source_file": str(document.get("file_name", "No especificado")),
                "detected_price": "No especificado",
                "warranty": "No especificado",
                "lead_time": "No especificado",
                "detected_costs": data_detected,
                "data_detected": data_detected,
                "data_missing": DEFAULT_MISSING_INFORMATION,
                "source_evidence": ["Deteccion preliminar basada en terminos encontrados en el documento; validar contra el PDF original."],
                "confidence_level": "low",
            }
        )
    return detected


def build_image_content_parts(paths: list[Path], files: list[UploadFile]) -> list[dict[str, Any]]:
    parts: list[dict[str, Any]] = []
    for path, upload in zip(paths, files):
        filename = upload.filename or path.name
        if detect_file_type(filename) not in IMAGE_FILE_TYPES:
            continue
        mime_type = mimetypes.guess_type(filename)[0] or "image/png"
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        parts.append({"type": "text", "text": f"Imagen adjunta para analisis TCO: {filename}"})
        parts.append(
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": mime_type,
                    "data": encoded,
                },
            }
        )
    return parts


async def analyze_tco_with_claude(
    user_prompt: str,
    image_parts: list[dict[str, Any]],
    documents: list[dict[str, Any]],
) -> dict[str, Any]:
    return await generate_agent_response(
        agentType="tco_analysis",
        systemPrompt=SYSTEM_PROMPT,
        userPrompt=user_prompt,
        documentPayload=documents,
        imageContent=image_parts,
        outputContract={
            "required": [
                "analysis_title",
                "item_name",
                "analysis_type",
                "evaluation_horizon",
                "currency",
                "executive_summary",
                "tco_matrix",
                "scorecard",
                "ranking",
                "final_recommendation",
            ],
            "quality": [
                "executiveSummary",
                "kpis",
                "findings",
                "tables",
                "risks",
                "recommendations",
                "missingCriticalData",
                "evidenceReferences",
                "downloadReadiness",
                "qualityWarnings",
            ],
        },
    )


def build_fallback_result(
    *,
    title: str,
    item_name: str,
    analysis_type: str,
    evaluation_horizon: str,
    comparison_unit: str,
    currency: str,
    documents: list[dict[str, Any]],
    reason: str = "El modelo de analisis no respondio dentro del tiempo operativo.",
) -> dict[str, Any]:
    detected = build_detected_alternatives_from_documents(documents) if documents else []

    return {
        "analysis_title": title,
        "item_name": item_name,
        "analysis_type": analysis_type,
        "evaluation_horizon": evaluation_horizon,
        "comparison_unit": comparison_unit,
        "currency": currency,
        "executive_summary": {
            "best_alternative": "No determinado",
            "best_alternative_score": None,
            "best_alternative_score_label": "No determinado",
            "why_it_wins": "No se completo el modelo TCO; no existe una recomendacion analitica final.",
            "estimated_saving_or_overcost": "No determinado",
            "main_risk": reason,
            "final_recommendation": "No adjudicar con este resultado preliminar. Reintentar el analisis y pedir informacion faltante antes de decidir.",
        },
        "data_used": [],
        "tco_matrix": [
            {
                "cost_component": "TCO total estimado",
                "values": {},
                "notes": PRELIMINARY_MISSING_INFO_NOTE,
            }
        ],
        "tco_totals": [],
        "ranking": [],
        "interpretation": {
            "why_winner_wins": "No determinado con precision por falta de datos completos.",
            "hidden_costs": ["Mantenimiento", "Repuestos", "Soporte", "Logistica", "Instalacion"],
            "cheap_but_risky_options": [],
            "expensive_but_convenient_options": [],
            "conditions_that_change_decision": ["Completar costos faltantes puede cambiar el ranking."],
        },
        "hidden_costs_detected": ["Mantenimiento", "Repuestos", "Soporte", "Logistica", "Instalacion"],
        "risk_analysis": [],
        "sensitivity_analysis": build_sensitivity_from_totals([]),
        "strategic_recommendation": {
            "recommended_action": "Pedir mas informacion",
            "economic_option": "No determinado",
            "technical_option": "No determinado",
            "lowest_risk_option": "No determinado",
            "balanced_option": "No determinado",
            "final_recommended_option": "No determinado",
            "recommendation_rationale": "No se completo el analisis; este resultado preliminar no debe usarse como recomendacion final.",
            "negotiation_points": ["Solicitar desglose de costos ocultos, garantia, soporte y lead time."],
            "next_steps": ["Completar costos faltantes y validar condiciones comerciales."],
        },
        "missing_information": [PRELIMINARY_MISSING_INFO_NOTE, *DEFAULT_MISSING_INFORMATION],
        "questions_for_user_or_suppliers": DEFAULT_SUPPLIER_QUESTIONS,
        "assumptions_and_limits": ["No se inventaron impuestos, aranceles ni tipo de cambio."],
        "supporting_documents_summary": documents,
        "detected_alternatives": detected,
        "extracted_data_quality": {
            "detected_alternatives_count": len(detected),
            "documents_processed": len(documents),
            "confidence_level": "low",
            "warnings": [f"{reason} Se preparo una respuesta limitada para que el usuario pueda reintentar, cambiar documentos o completar informacion."]
            if documents
            else [],
        },
        "calculation_warnings": [
            "No se ejecuto calculo financiero ni ranking porque el modelo no respondio a tiempo.",
            "No se debe usar este resultado como recomendacion de adjudicacion.",
        ],
        "downloadReadiness": {
            "status": "blocked",
            "reason": reason,
        },
        "scorecard": None,
        "model_timed_out": True,
        "disclaimer": "Este analisis TCO es una recomendacion asistida por IA y debe ser validado por el comprador antes de tomar una decision final.",
    }


def ensure_result_defaults(
    result: dict[str, Any],
    *,
    title: str,
    item_name: str,
    analysis_type: str,
    evaluation_horizon: str,
    comparison_unit: str,
    currency: str,
) -> dict[str, Any]:
    result.setdefault("analysis_title", title)
    result.setdefault("item_name", item_name)
    result.setdefault("analysis_type", analysis_type)
    result.setdefault("evaluation_horizon", evaluation_horizon)
    result.setdefault("comparison_unit", comparison_unit)
    result.setdefault("currency", currency)
    result.setdefault(
        "executive_summary",
        {
            "best_alternative": "No determinado",
            "best_alternative_score": None,
            "best_alternative_score_label": "No determinado",
            "why_it_wins": "Falta informacion para definir una alternativa ganadora.",
            "estimated_saving_or_overcost": "No determinado",
            "main_risk": "Informacion incompleta",
            "final_recommendation": "Completar datos faltantes antes de decidir.",
        },
    )
    result.setdefault(
        "interpretation",
        {
            "why_winner_wins": "No determinado",
            "hidden_costs": [],
            "cheap_but_risky_options": [],
            "expensive_but_convenient_options": [],
            "conditions_that_change_decision": [],
        },
    )
    result.setdefault(
        "strategic_recommendation",
        {
            "recommended_action": "Pedir mas informacion",
            "economic_option": None,
            "technical_option": None,
            "lowest_risk_option": None,
            "balanced_option": None,
            "final_recommended_option": None,
            "recommendation_rationale": "Falta informacion para emitir una recomendacion final robusta.",
            "negotiation_points": [],
            "next_steps": [],
        },
    )
    result.setdefault("data_used", [])
    result.setdefault("tco_matrix", [])
    result.setdefault("base_parameters", None)
    result.setdefault("benchmark_assumptions", [])
    result.setdefault("transparency_table", [])
    result.setdefault("financial_model", [])
    result.setdefault("scorecard", None)
    result.setdefault("tco_totals", [])
    result.setdefault("ranking", [])
    result.setdefault("hidden_costs_detected", [])
    result.setdefault("risk_analysis", [])
    result.setdefault("detected_alternatives", [])
    result.setdefault(
        "extracted_data_quality",
        {
            "detected_alternatives_count": len(result.get("detected_alternatives", [])),
            "documents_processed": 0,
            "confidence_level": "low",
            "warnings": [],
        },
    )
    result.setdefault("missing_information", [])
    result.setdefault("questions_for_user_or_suppliers", [])
    result.setdefault("assumptions_and_limits", [])
    result.setdefault("calculation_warnings", [])
    return result


def sanitize_base_parameters(result: dict[str, Any]) -> dict[str, Any]:
    params = result.get("base_parameters") if isinstance(result.get("base_parameters"), dict) else {}
    notes = [_as_text(value) for value in _as_list(params.get("notes"))]
    if not notes:
        notes = ["Parametros base normalizados desde el contexto, documentos o resultado estructurado del agente."]
    inferred_horizon = _infer_horizon_years(result.get("evaluation_horizon"))
    horizon_years = inferred_horizon if inferred_horizon != "Dato faltante" else params.get("horizon_years")

    return {
        "analysis_type": _as_text(params.get("analysis_type") or result.get("analysis_type"), "Dato faltante"),
        "product_or_service": _as_text(params.get("product_or_service") or result.get("item_name"), "Dato faltante"),
        "currency": _as_text(params.get("currency") or result.get("currency"), "Dato faltante"),
        "horizon_years": _value_or_status(horizon_years),
        "quantity": _value_or_status(params.get("quantity") or next((item.get("quantity") for item in _as_list(result.get("data_used")) if isinstance(item, dict) and item.get("quantity")), None)),
        "unit_of_comparison": _as_text(params.get("unit_of_comparison") or result.get("comparison_unit"), "Dato faltante"),
        "annual_usage": _value_or_status(params.get("annual_usage")),
        "annual_km": _value_or_status(params.get("annual_km"), "km"),
        "useful_life_years": _value_or_status(params.get("useful_life_years")),
        "exchange_rate": _value_or_status(params.get("exchange_rate")),
        "discount_rate": _value_or_status(params.get("discount_rate")),
        "tax_rate": _value_or_status(params.get("tax_rate")),
        "financing_rate": _value_or_status(params.get("financing_rate")),
        "notes": notes,
    }


def sanitize_benchmark_assumptions(result: dict[str, Any]) -> list[dict[str, Any]]:
    sanitized = [
        {
            "field": _as_text(item.get("field")),
            "value": _value_or_status(item.get("value")),
            "range_min": None if item.get("range_min") is None else _value_or_status(item.get("range_min")),
            "range_max": None if item.get("range_max") is None else _value_or_status(item.get("range_max")),
            "unit": None if item.get("unit") is None else _as_text(item.get("unit")),
            "reason": _as_text(item.get("reason"), "Estimacion declarada para completar un analisis preliminar."),
            "source_type": _normalize_source_type(item.get("source_type")),
            "confidence_level": _normalize_spanish_confidence(item.get("confidence_level")),
            "applies_to": _as_text(item.get("applies_to"), "General"),
            "warning": _as_text(item.get("warning"), "Validar este supuesto antes de tomar una decision final."),
        }
        for item in _as_list(result.get("benchmark_assumptions"))
        if isinstance(item, dict)
    ]
    if sanitized:
        return sanitized

    missing = [
        item for item in _as_list(result.get("missing_information"))
        if _as_text(item, "") and PRELIMINARY_MISSING_INFO_NOTE not in _as_text(item, "")
    ]
    return [
        {
            "field": _as_text(item),
            "value": "Dato faltante",
            "range_min": None,
            "range_max": None,
            "unit": None,
            "reason": "Dato critico identificado para mejorar la precision del TCO.",
            "source_type": "estimado",
            "confidence_level": "baja",
            "applies_to": "General",
            "warning": "No se aplico benchmark cuantitativo; solicitar o validar con proveedor antes de decidir.",
        }
        for item in missing[:12]
    ]


def build_financial_model(result: dict[str, Any]) -> list[dict[str, Any]]:
    alternatives = _alternative_names(result)
    existing = {
        _as_text(item.get("alternative"), ""): item
        for item in _as_list(result.get("financial_model"))
        if isinstance(item, dict) and _as_text(item.get("alternative"), "")
    }
    totals = {
        _as_text(item.get("alternative"), ""): item
        for item in _as_list(result.get("tco_totals"))
        if isinstance(item, dict) and _as_text(item.get("alternative"), "")
    }

    rows: list[dict[str, Any]] = []
    for alternative in alternatives:
        model: dict[str, Any] = {field: None for field in FINANCIAL_MODEL_FIELDS}
        warnings: list[str] = []

        for matrix_row in _as_list(result.get("tco_matrix")):
            if not isinstance(matrix_row, dict) or not isinstance(matrix_row.get("values"), dict):
                continue
            category = _financial_category(_as_text(matrix_row.get("cost_component"), ""))
            if not category or category in {"net_tco", "annualized_tco", "unit_tco", "usage_tco"}:
                continue
            value = _as_number(matrix_row["values"].get(alternative))
            if value is None:
                continue
            if category == "residual_value":
                model[category] = _safe_add(_as_number(model[category]), value)
            else:
                model[category] = _safe_add(_as_number(model[category]), value)

        for assumption in _as_list(result.get("benchmark_assumptions")):
            if not isinstance(assumption, dict):
                continue
            applies_to = _as_text(assumption.get("applies_to"), "General")
            if applies_to not in {"General", alternative}:
                continue
            category = _financial_category(_as_text(assumption.get("field"), ""))
            value = _as_number(assumption.get("value"))
            if not category or category in {"net_tco", "annualized_tco", "unit_tco", "usage_tco"} or value is None:
                continue
            model[category] = _safe_add(_as_number(model[category]), value)
            warnings.append(f"Se uso benchmark declarado para {_as_text(assumption.get('field'))}; validar con proveedor.")

        total = totals.get(alternative, {})
        if total:
            model["acquisition_costs"] = _as_number(total.get("initial_price")) or model["acquisition_costs"]
            model["net_tco"] = _as_number(total.get("total_tco"))
            model["annualized_tco"] = _as_number(total.get("tco_annual"))
            model["unit_tco"] = _as_number(total.get("tco_per_unit"))

        if model["net_tco"] is None:
            positive_fields = [
                "acquisition_costs", "logistics_costs", "implementation_costs", "operating_costs",
                "maintenance_costs", "support_costs", "insurance_costs", "financing_costs",
                "administrative_costs", "risk_costs", "exit_costs",
            ]
            available_values = [_as_number(model[field]) for field in positive_fields]
            if any(value is not None for value in available_values):
                subtotal = sum(value or 0 for value in available_values)
                residual = _as_number(model["residual_value"]) or 0
                model["net_tco"] = subtotal - residual
                warnings.append("TCO neto calculado desde componentes del resultado estructurado; no cambia la recomendacion del agente.")
            else:
                model["net_tco"] = "No calculable con datos actuales"
                warnings.append("Faltan costos numericos suficientes para calcular TCO neto.")

        horizon = _as_number((result.get("base_parameters") or {}).get("horizon_years") if isinstance(result.get("base_parameters"), dict) else None)
        if model["annualized_tco"] is None and _as_number(model["net_tco"]) is not None and horizon and horizon > 0:
            model["annualized_tco"] = (_as_number(model["net_tco"]) or 0) / horizon
        if model["annualized_tco"] is None:
            model["annualized_tco"] = "No calculable con datos actuales"

        quantity = _as_number((result.get("base_parameters") or {}).get("quantity") if isinstance(result.get("base_parameters"), dict) else None)
        if model["unit_tco"] is None and _as_number(model["net_tco"]) is not None and quantity and quantity > 0:
            model["unit_tco"] = (_as_number(model["net_tco"]) or 0) / quantity
        if model["unit_tco"] is None:
            model["unit_tco"] = "No calculable con datos actuales"
        if model["usage_tco"] is None:
            model["usage_tco"] = "No calculable con datos actuales"

        existing_item = existing.get(alternative, {})
        for field in FINANCIAL_MODEL_FIELDS:
            if isinstance(existing_item, dict) and existing_item.get(field) not in {None, ""}:
                model[field] = _value_or_status(existing_item.get(field), field)
            else:
                model[field] = _value_or_status(model[field], field)

        rows.append(
            {
                "alternative": alternative,
                **model,
                "calculation_basis": _as_text(
                    existing_item.get("calculation_basis") if isinstance(existing_item, dict) else None,
                    "TCO_NETO = inversion inicial + logistica + implementacion + operacion + mantenimiento + soporte + seguros + financiamiento + administracion + riesgo + salida - valor residual.",
                ),
                "confidence_level": _normalize_spanish_confidence(
                    existing_item.get("confidence_level") if isinstance(existing_item, dict) else None,
                    "media" if _as_number(model["net_tco"]) is not None else "baja",
                ),
                "warnings": [
                    *_as_list(existing_item.get("warnings") if isinstance(existing_item, dict) else []),
                    *warnings,
                ],
            }
        )
    return rows


def build_transparency_table(result: dict[str, Any]) -> list[dict[str, Any]]:
    rows = [
        {
            "alternative": _as_text(item.get("alternative"), "General"),
            "field": _as_text(item.get("field")),
            "value": _value_or_status(item.get("value"), _as_text(item.get("field"), "")),
            "source": _as_text(item.get("source"), "No disponible"),
            "type": _normalize_data_type(item.get("type")),
            "confidence_level": _normalize_spanish_confidence(item.get("confidence_level")),
            "observation": _as_text(item.get("observation"), "Sin observacion adicional."),
        }
        for item in _as_list(result.get("transparency_table"))
        if isinstance(item, dict)
    ]
    seen = {(row["alternative"], row["field"], str(row["value"])) for row in rows}

    def add_row(row: dict[str, Any]) -> None:
        key = (row["alternative"], row["field"], str(row["value"]))
        if key not in seen:
            rows.append(row)
            seen.add(key)

    for item in _as_list(result.get("detected_alternatives")):
        if not isinstance(item, dict):
            continue
        alternative = _as_text(item.get("supplier_name"))
        source = _as_text(item.get("source_file"), "Documento")
        for field, raw_value in [
            ("Precio detectado", item.get("detected_price")),
            ("Garantia", item.get("warranty")),
            ("Lead time", item.get("lead_time")),
        ]:
            value = _value_or_status(raw_value)
            add_row(
                {
                    "alternative": alternative,
                    "field": field,
                    "value": value,
                    "source": source if value != "Dato faltante" else "No disponible",
                    "type": "documento" if value != "Dato faltante" else "faltante",
                    "confidence_level": _normalize_spanish_confidence(item.get("confidence_level")),
                    "observation": "Extraido o declarado por el agente desde la evidencia documental disponible.",
                }
            )

    for matrix_row in _as_list(result.get("tco_matrix")):
        if not isinstance(matrix_row, dict) or not isinstance(matrix_row.get("values"), dict):
            continue
        field = _as_text(matrix_row.get("cost_component"))
        for alternative, raw_value in matrix_row["values"].items():
            value = _value_or_status(raw_value, field)
            number = _as_number(value)
            is_missing_value = str(value).strip().lower() in {
                "dato faltante",
                "no calculable con datos actuales",
                "no especificado",
                "no determinado",
            }
            add_row(
                {
                    "alternative": _as_text(alternative),
                    "field": field,
                    "value": value,
                    "source": "Resultado estructurado TCO",
                    "type": "calculado" if not is_missing_value else "faltante",
                    "confidence_level": "media" if (number is not None or not is_missing_value) else "baja",
                    "observation": _as_text(matrix_row.get("notes"), "Componente usado para matriz TCO."),
                }
            )

    for item in _as_list(result.get("benchmark_assumptions")):
        if not isinstance(item, dict):
            continue
        add_row(
            {
                "alternative": _as_text(item.get("applies_to"), "General"),
                "field": _as_text(item.get("field")),
                "value": _value_or_status(item.get("value")),
                "source": _normalize_source_type(item.get("source_type")),
                "type": "estimado",
                "confidence_level": _normalize_spanish_confidence(item.get("confidence_level")),
                "observation": _as_text(item.get("warning"), "Benchmark o estimado declarado; validar antes de decidir."),
            }
        )

    return rows


def build_scorecard(result: dict[str, Any]) -> dict[str, Any]:
    alternatives = _alternative_names(result)
    existing = result.get("scorecard") if isinstance(result.get("scorecard"), dict) else {}
    if len(alternatives) < 2 and existing.get("criteria"):
        alternatives = [
            _as_text(item.get("alternative"), "")
            for item in _as_list(existing.get("totals"))
            if isinstance(item, dict) and _as_text(item.get("alternative"), "")
        ] or alternatives
    profile_key = _scorecard_profile_key(result.get("analysis_type"))
    profile = SCORECARD_PROFILES[profile_key]
    financial_by_alt = {
        _as_text(item.get("alternative"), ""): item
        for item in _as_list(result.get("financial_model"))
        if isinstance(item, dict) and _as_text(item.get("alternative"), "")
    }

    criteria: list[dict[str, Any]] = []
    totals_accumulator = {alternative: 0.0 for alternative in alternatives}
    confidence_by_alt: dict[str, list[str]] = {alternative: [] for alternative in alternatives}
    strength_candidates: dict[str, list[tuple[float, str]]] = {alternative: [] for alternative in alternatives}
    weakness_candidates: dict[str, list[tuple[float, str]]] = {alternative: [] for alternative in alternatives}

    for criterion_id, name, weight, financial_field, mode, keywords in profile:
        raw_values: dict[str, float | None] = {}
        for alternative in alternatives:
            financial = financial_by_alt.get(alternative, {})
            raw_values[alternative] = _as_number(financial.get(financial_field)) if financial_field else None

        if mode == "cost":
            normalized_scores = _cost_scores(raw_values, lower_is_better=True)
        elif mode == "risk":
            normalized_scores = {
                alternative: (_cost_scores(raw_values, lower_is_better=True).get(alternative) if any(value is not None for value in raw_values.values()) else _risk_penalty(result, alternative, keywords)[0])
                for alternative in alternatives
            }
        else:
            normalized_scores = _cost_scores(raw_values, lower_is_better=False) if any(value is not None for value in raw_values.values()) else {}

        alternative_rows: list[dict[str, Any]] = []
        for alternative in alternatives:
            evidence_item = _find_transparency_evidence(result, alternative, keywords)
            raw_value: Any = raw_values.get(alternative)
            source = "calculado" if raw_value is not None else "faltante"
            confidence = "media" if raw_value is not None else "baja"
            evidence = "Dato financiero calculado desde financial_model." if raw_value is not None else "Dato no disponible en financial_model."
            comment = "Puntaje calculado con base cuantitativa disponible." if raw_value is not None else "Puntaje preliminar penalizado por falta de dato directo."

            if evidence_item:
                evidence_value = _value_or_status(evidence_item.get("value"), name)
                evidence = f"{_as_text(evidence_item.get('field'))}: {evidence_value}"
                source = _scorecard_source_from_type(evidence_item.get("type"))
                confidence = _normalize_spanish_confidence(evidence_item.get("confidence_level"))
                if raw_value is None:
                    raw_value = evidence_value
                    if source == "faltante":
                        normalized_scores[alternative] = min(normalized_scores.get(alternative, 55), 55)
                    elif mode == "benefit":
                        normalized_scores[alternative] = _qualitative_benefit_score(evidence_value, confidence)

            if mode == "risk" and raw_values.get(alternative) is None:
                risk_score, risk_comment = _risk_penalty(result, alternative, keywords)
                normalized_scores[alternative] = risk_score
                comment = risk_comment

            if source in {"estimado", "benchmark"}:
                normalized_scores[alternative] = min(normalized_scores.get(alternative, 65), 72)
                confidence = "media" if confidence == "alta" else confidence
                comment = f"{comment} Dato estimado/benchmark; validar antes de decidir."
            if source == "faltante":
                normalized_scores[alternative] = min(normalized_scores.get(alternative, 55), 55)
                confidence = "baja"

            normalized = round(float(normalized_scores.get(alternative, 55)), 2)
            weighted = round(normalized * float(weight) / 100, 2)
            totals_accumulator[alternative] += weighted
            confidence_by_alt[alternative].append(confidence)
            strength_candidates[alternative].append((normalized, name))
            weakness_candidates[alternative].append((normalized, name))
            alternative_rows.append(
                {
                    "alternative": alternative,
                    "raw_value": _value_or_status(raw_value, name),
                    "normalized_score": normalized,
                    "weighted_score": weighted,
                    "evidence": evidence,
                    "source": source,
                    "confidence_level": confidence,
                    "comment": comment,
                }
            )

        criteria.append(
            {
                "criterion_id": criterion_id,
                "criterion_name": name,
                "description": f"Criterio ponderado para {_as_text(result.get('analysis_type'), profile_key)}.",
                "weight": weight,
                "applies_to_analysis_type": profile_key,
                "scoring_logic": "Costo menor obtiene mayor puntaje; beneficios y soporte con mejor evidencia obtienen mayor puntaje; riesgos y datos faltantes penalizan score y confianza.",
                "alternatives": alternative_rows,
            }
        )

    ordered = sorted(totals_accumulator.items(), key=lambda item: item[1], reverse=True)
    totals = []
    for rank, (alternative, total_score) in enumerate(ordered, start=1):
        strengths = sorted(strength_candidates.get(alternative, []), reverse=True)
        weaknesses = sorted(weakness_candidates.get(alternative, []))
        totals.append(
            {
                "alternative": alternative,
                "total_score": round(total_score, 2),
                "level": _score_level(total_score),
                "rank": rank,
                "main_strength": strengths[0][1] if strengths else "No determinado",
                "main_weakness": weaknesses[0][1] if weaknesses else "No determinado",
                "confidence_level": _combined_confidence(confidence_by_alt.get(alternative, [])),
            }
        )

    economic_option = min(
        (item for item in _as_list(result.get("financial_model")) if isinstance(item, dict) and _as_number(item.get("net_tco")) is not None),
        key=lambda item: _as_number(item.get("net_tco")) or float("inf"),
        default=None,
    )
    lowest_risk = max(
        totals,
        key=lambda item: ({"alta": 3, "media": 2, "baja": 1}.get(item["confidence_level"], 1), item["total_score"]),
        default=None,
    )
    winner = totals[0] if totals else None
    decision_summary = {
        "economic_option": _as_text(economic_option.get("alternative") if isinstance(economic_option, dict) else None, winner["alternative"] if winner else "No determinado"),
        "technical_option": winner["alternative"] if winner else "No determinado",
        "lowest_risk_option": lowest_risk["alternative"] if lowest_risk else "No determinado",
        "balanced_option": winner["alternative"] if winner else "No determinado",
        "final_recommended_option": winner["alternative"] if winner else "No determinado",
        "rationale": (
            f"{winner['alternative']} obtiene el mayor score multicriterio ({winner['total_score']}/100), "
            f"con fortaleza principal en {winner['main_strength']} y debilidad principal en {winner['main_weakness']}."
        )
        if winner
        else "No hay suficientes alternativas para construir scorecard.",
    }

    return {
        "scoring_method": f"Scorecard multicriterio TCO de 100 puntos adaptado a {profile_key}. Weighted score = normalized_score * weight / 100.",
        "total_possible_score": 100,
        "confidence_level": _combined_confidence([item["confidence_level"] for item in totals]),
        "criteria": criteria,
        "totals": totals,
        "decision_summary": decision_summary,
    }


def sanitize_scorecard(result: dict[str, Any]) -> dict[str, Any]:
    existing = result.get("scorecard") if isinstance(result.get("scorecard"), dict) else {}
    if not existing.get("criteria") or not existing.get("totals"):
        return build_scorecard(result)

    criteria: list[dict[str, Any]] = []
    for criterion in _as_list(existing.get("criteria")):
        if not isinstance(criterion, dict):
            continue
        weight = _as_number(criterion.get("weight")) or 0
        alternatives = []
        for item in _as_list(criterion.get("alternatives")):
            if not isinstance(item, dict):
                continue
            normalized = _as_number(item.get("normalized_score"))
            weighted = _as_number(item.get("weighted_score"))
            if weighted is not None and weighted > 100 and weight:
                weighted = weighted / 100
            if weighted is None and normalized is not None:
                weighted = normalized * weight / 100
            alternatives.append(
                {
                    "alternative": _as_text(item.get("alternative")),
                    "raw_value": _value_or_status(item.get("raw_value"), _as_text(criterion.get("criterion_name"), "")),
                    "normalized_score": round(normalized if normalized is not None else 55, 2),
                    "weighted_score": round(weighted if weighted is not None else 0, 2),
                    "evidence": _as_text(item.get("evidence"), "Evidencia no especificada."),
                    "source": _scorecard_source_from_type(item.get("source")),
                    "confidence_level": _normalize_spanish_confidence(item.get("confidence_level")),
                    "comment": _as_text(item.get("comment"), "Puntaje preliminar."),
                }
            )
        criteria.append(
            {
                "criterion_id": _as_text(criterion.get("criterion_id"), f"criterion_{len(criteria) + 1}"),
                "criterion_name": _as_text(criterion.get("criterion_name"), "Criterio"),
                "description": None if criterion.get("description") is None else _as_text(criterion.get("description")),
                "weight": weight,
                "applies_to_analysis_type": None if criterion.get("applies_to_analysis_type") is None else _as_text(criterion.get("applies_to_analysis_type")),
                "scoring_logic": None if criterion.get("scoring_logic") is None else _as_text(criterion.get("scoring_logic")),
                "alternatives": alternatives,
            }
        )

    totals = []
    for index, item in enumerate(_as_list(existing.get("totals")), start=1):
        if not isinstance(item, dict):
            continue
        score = _as_number(item.get("total_score")) or 0
        totals.append(
            {
                "alternative": _as_text(item.get("alternative")),
                "total_score": round(score, 2),
                "level": _as_text(item.get("level"), _score_level(score)),
                "rank": int(_as_number(item.get("rank")) or index),
                "main_strength": _as_text(item.get("main_strength"), "No determinado"),
                "main_weakness": _as_text(item.get("main_weakness"), "No determinado"),
                "confidence_level": _normalize_spanish_confidence(item.get("confidence_level")),
            }
        )
    net_tco_by_alt = {
        _as_text(item.get("alternative"), ""): _as_number(item.get("net_tco"))
        for item in _as_list(result.get("financial_model"))
        if isinstance(item, dict)
    }
    totals = sorted(
        totals,
        key=lambda item: (
            -float(item["total_score"]),
            net_tco_by_alt.get(item["alternative"]) if net_tco_by_alt.get(item["alternative"]) is not None else float("inf"),
            -_confidence_rank(item["confidence_level"]),
        ),
    )
    for index, item in enumerate(totals, start=1):
        item["rank"] = index
    decision = existing.get("decision_summary") if isinstance(existing.get("decision_summary"), dict) else {}
    fallback = build_scorecard({**result, "scorecard": {}})
    fallback_decision = fallback["decision_summary"]
    return {
        "scoring_method": _as_text(existing.get("scoring_method"), "Scorecard multicriterio TCO ponderado de 100 puntos"),
        "total_possible_score": _as_number(existing.get("total_possible_score")) or 100,
        "confidence_level": _normalize_spanish_confidence(existing.get("confidence_level"), _combined_confidence([item["confidence_level"] for item in totals])),
        "criteria": criteria,
        "totals": totals,
        "decision_summary": {
            "economic_option": _as_text(decision.get("economic_option"), fallback_decision.get("economic_option")),
            "technical_option": _as_text(decision.get("technical_option"), fallback_decision.get("technical_option")),
            "lowest_risk_option": _as_text(decision.get("lowest_risk_option"), fallback_decision.get("lowest_risk_option")),
            "balanced_option": _as_text(decision.get("balanced_option"), fallback_decision.get("balanced_option")),
            "final_recommended_option": _as_text(decision.get("final_recommended_option"), fallback_decision.get("final_recommended_option")),
            "rationale": _as_text(decision.get("rationale"), fallback_decision.get("rationale")),
        },
    }


def reinforce_recommendation_from_scorecard(result: dict[str, Any]) -> None:
    scorecard = result.get("scorecard") if isinstance(result.get("scorecard"), dict) else {}
    decision = scorecard.get("decision_summary") if isinstance(scorecard.get("decision_summary"), dict) else {}
    recommendation = result.get("strategic_recommendation") if isinstance(result.get("strategic_recommendation"), dict) else {}
    for target, source in [
        ("economic_option", "economic_option"),
        ("technical_option", "technical_option"),
        ("lowest_risk_option", "lowest_risk_option"),
        ("balanced_option", "balanced_option"),
        ("final_recommended_option", "final_recommended_option"),
        ("recommendation_rationale", "rationale"),
    ]:
        current = _as_text(recommendation.get(target), "")
        if not current or current in {"No especificado", "No determinado"}:
            recommendation[target] = decision.get(source)
    result["strategic_recommendation"] = recommendation


def sync_ranking_from_scorecard(result: dict[str, Any]) -> None:
    scorecard = result.get("scorecard") if isinstance(result.get("scorecard"), dict) else {}
    totals = _as_list(scorecard.get("totals"))
    if not totals:
        result["ranking"] = sorted(
            _as_list(result.get("ranking")),
            key=lambda item: -(_as_number(item.get("score")) or 0) if isinstance(item, dict) else 0,
        )
        for index, item in enumerate(result["ranking"], start=1):
            if isinstance(item, dict):
                item["position"] = index
        return

    total_tco_by_alt = {
        _as_text(item.get("alternative"), ""): _as_number(item.get("net_tco"))
        for item in _as_list(result.get("financial_model"))
        if isinstance(item, dict)
    }
    result["ranking"] = [
        {
            "position": index,
            "alternative": _as_text(item.get("alternative")),
            "ranking_type": "Scorecard multicriterio",
            "total_tco": total_tco_by_alt.get(_as_text(item.get("alternative"), "")),
            "score": _as_number(item.get("total_score")),
            "score_label": _as_text(item.get("level"), _score_level(_as_number(item.get("total_score")))),
            "score_breakdown": {},
            "source_basis": ["scorecard", "financial_model", "transparency_table"],
            "reason": (
                f"Fortaleza principal: {_as_text(item.get('main_strength'), 'No determinado')}. "
                f"Debilidad principal: {_as_text(item.get('main_weakness'), 'No determinado')}. "
                f"Confianza: {_as_text(item.get('confidence_level'), 'baja')}."
            ),
        }
        for index, item in enumerate(totals, start=1)
        if isinstance(item, dict)
    ]


def sanitize_tco_result(result: dict[str, Any]) -> dict[str, Any]:
    usage = result.pop("_usage", {}) if isinstance(result.get("_usage"), dict) else {}

    summary = result.get("executive_summary") if isinstance(result.get("executive_summary"), dict) else {}
    result["executive_summary"] = {
        "best_alternative": _as_text(summary.get("best_alternative"), "No determinado"),
        "best_alternative_score": _as_number(summary.get("best_alternative_score")),
        "best_alternative_score_label": _as_text(summary.get("best_alternative_score_label"), "No determinado"),
        "why_it_wins": _as_text(summary.get("why_it_wins"), "No determinado"),
        "estimated_saving_or_overcost": _as_text(summary.get("estimated_saving_or_overcost"), "No determinado"),
        "main_risk": _as_text(summary.get("main_risk"), "Informacion incompleta"),
        "final_recommendation": _as_text(summary.get("final_recommendation"), "Validar datos antes de decidir."),
    }

    result["data_used"] = [
        {
            "alternative": _as_text(item.get("alternative") or item.get("supplier_name")),
            "base_price": None if item.get("base_price") is None else _as_text(item.get("base_price")),
            "quantity": None if item.get("quantity") is None else _as_text(item.get("quantity")),
            "currency": None if item.get("currency") is None else _as_text(item.get("currency")),
            "horizon": None if item.get("horizon") is None else _as_text(item.get("horizon")),
            "origin": None if item.get("origin") is None else _as_text(item.get("origin")),
            "destination": None if item.get("destination") is None else _as_text(item.get("destination")),
            "incoterm": None if item.get("incoterm") is None else _as_text(item.get("incoterm")),
            "lead_time": None if item.get("lead_time") is None else _as_text(item.get("lead_time")),
            "key_assumptions": [_as_text(value) for value in _as_list(item.get("key_assumptions"))],
        }
        for item in _as_list(result.get("data_used"))
        if isinstance(item, dict)
    ]

    result["tco_matrix"] = [
        {
            "cost_component": _as_text(item.get("cost_component")),
            "values": item.get("values") if isinstance(item.get("values"), dict) else {},
            "notes": _as_text(item.get("notes"), ""),
        }
        for item in _as_list(result.get("tco_matrix"))
        if isinstance(item, dict)
    ]

    result["tco_totals"] = [
        {
            "alternative": _as_text(item.get("alternative") or item.get("supplier_name")),
            "initial_price": _as_number(item.get("initial_price")),
            "total_tco": _as_number(item.get("total_tco")),
            "tco_per_unit": _as_number(item.get("tco_per_unit")),
            "tco_monthly": _as_number(item.get("tco_monthly")),
            "tco_annual": _as_number(item.get("tco_annual")),
            "risk_level": _normalize_level(item.get("risk_level")),
            "main_hidden_costs": [_as_text(value) for value in _as_list(item.get("main_hidden_costs"))],
        }
        for item in _as_list(result.get("tco_totals"))
        if isinstance(item, dict)
    ]

    result["ranking"] = [
        {
            "position": int(_as_number(item.get("position")) or index),
            "alternative": _as_text(item.get("alternative") or item.get("supplier_name")),
            "ranking_type": _as_text(item.get("ranking_type"), "Mejor balance costo-beneficio"),
            "total_tco": (
                None
                if _as_number(item.get("total_tco")) == 0
                and not _has_numeric_evidence_for_alternative(result, _as_text(item.get("alternative") or item.get("supplier_name"), ""))
                else _as_number(item.get("total_tco"))
            ),
            "score": _as_number(item.get("score")),
            "score_label": _as_text(item.get("score_label"), "No determinado"),
            "score_breakdown": item.get("score_breakdown") if isinstance(item.get("score_breakdown"), dict) else {},
            "source_basis": [_as_text(value) for value in _as_list(item.get("source_basis"))],
            "reason": _as_text(item.get("reason"), "Ranking preliminar construido con la informacion disponible."),
        }
        for index, item in enumerate(_as_list(result.get("ranking")), start=1)
        if isinstance(item, dict)
    ]

    interpretation = result.get("interpretation") if isinstance(result.get("interpretation"), dict) else {}
    result["interpretation"] = {
        "why_winner_wins": _as_text(interpretation.get("why_winner_wins"), "No determinado"),
        "hidden_costs": [_as_text(value) for value in _as_list(interpretation.get("hidden_costs"))],
        "cheap_but_risky_options": [_as_text(value) for value in _as_list(interpretation.get("cheap_but_risky_options"))],
        "expensive_but_convenient_options": [_as_text(value) for value in _as_list(interpretation.get("expensive_but_convenient_options"))],
        "conditions_that_change_decision": [_as_text(value) for value in _as_list(interpretation.get("conditions_that_change_decision"))],
    }

    hidden_costs = [
        *_as_list(result.get("hidden_costs_detected")),
        *_as_list(result["interpretation"].get("hidden_costs")),
        *[cost for total in result["tco_totals"] for cost in _as_list(total.get("main_hidden_costs"))],
    ]
    result["hidden_costs_detected"] = list(dict.fromkeys(_as_text(item) for item in hidden_costs if _as_text(item, "")))

    result["risk_analysis"] = [
        {
            "risk": _as_text(item.get("risk")),
            "alternative": _as_text(item.get("alternative"), "General"),
            "probability": None if item.get("probability") is None else _as_text(item.get("probability")),
            "economic_impact": None if item.get("economic_impact") is None else _as_text(item.get("economic_impact")),
            "expected_risk_cost": None if item.get("expected_risk_cost") is None else _as_text(item.get("expected_risk_cost")),
            "level": _normalize_level(item.get("level")),
            "mitigation": _as_text(item.get("mitigation"), "Validar y documentar mitigacion."),
        }
        for item in _as_list(result.get("risk_analysis"))
        if isinstance(item, dict)
    ]

    result["detected_alternatives"] = [
        {
            "supplier_name": _as_text(item.get("supplier_name")),
            "source_file": _as_text(item.get("source_file")),
            "detected_price": None if item.get("detected_price") is None else _as_text(item.get("detected_price")),
            "warranty": None if item.get("warranty") is None else _as_text(item.get("warranty")),
            "lead_time": None if item.get("lead_time") is None else _as_text(item.get("lead_time")),
            "detected_costs": [_as_text(value) for value in _as_list(item.get("detected_costs"))],
            "data_detected": [_as_text(value) for value in _as_list(item.get("data_detected"))],
            "data_missing": [_as_text(value) for value in _as_list(item.get("data_missing"))],
            "source_evidence": [_as_text(value) for value in _as_list(item.get("source_evidence"))],
            "confidence_level": _normalize_level(item.get("confidence_level"), "low"),
        }
        for item in _as_list(result.get("detected_alternatives"))
        if isinstance(item, dict)
    ]

    quality = result.get("extracted_data_quality") if isinstance(result.get("extracted_data_quality"), dict) else {}
    result["extracted_data_quality"] = {
        "detected_alternatives_count": int(_as_number(quality.get("detected_alternatives_count")) or len(result["detected_alternatives"])),
        "documents_processed": int(_as_number(quality.get("documents_processed")) or 0),
        "confidence_level": _normalize_level(quality.get("confidence_level"), "low"),
        "warnings": [_as_text(value) for value in _as_list(quality.get("warnings"))],
    }

    recommendation = result.get("strategic_recommendation") if isinstance(result.get("strategic_recommendation"), dict) else {}
    result["strategic_recommendation"] = {
        "recommended_action": _as_text(recommendation.get("recommended_action"), "Pedir mas informacion"),
        "economic_option": None if recommendation.get("economic_option") is None else _as_text(recommendation.get("economic_option")),
        "technical_option": None if recommendation.get("technical_option") is None else _as_text(recommendation.get("technical_option")),
        "lowest_risk_option": None if recommendation.get("lowest_risk_option") is None else _as_text(recommendation.get("lowest_risk_option")),
        "balanced_option": None if recommendation.get("balanced_option") is None else _as_text(recommendation.get("balanced_option")),
        "final_recommended_option": None if recommendation.get("final_recommended_option") is None else _as_text(recommendation.get("final_recommended_option")),
        "recommendation_rationale": None if recommendation.get("recommendation_rationale") is None else _as_text(recommendation.get("recommendation_rationale")),
        "negotiation_points": [_as_text(value) for value in _as_list(recommendation.get("negotiation_points"))],
        "next_steps": [_as_text(value) for value in _as_list(recommendation.get("next_steps"))],
    }

    sensitivity = result.get("sensitivity_analysis") if isinstance(result.get("sensitivity_analysis"), dict) else {}
    if not sensitivity:
        sensitivity = build_sensitivity_from_totals(result.get("tco_totals", []))
    result["sensitivity_analysis"] = {
        "base": [_as_text(value) for value in _as_list(sensitivity.get("base"))],
        "optimistic": [_as_text(value) for value in _as_list(sensitivity.get("optimistic"))],
        "pessimistic": [_as_text(value) for value in _as_list(sensitivity.get("pessimistic"))],
        "break_even": [_as_text(value) for value in _as_list(sensitivity.get("break_even"))],
        "most_sensitive_variable": _as_text(sensitivity.get("most_sensitive_variable"), "Datos de costos incompletos"),
    }

    for key in ["missing_information", "questions_for_user_or_suppliers", "assumptions_and_limits", "calculation_warnings"]:
        result[key] = [_as_text(value) for value in _as_list(result.get(key))]

    if PRELIMINARY_MISSING_INFO_NOTE not in result["missing_information"]:
        result["missing_information"] = [PRELIMINARY_MISSING_INFO_NOTE, *result["missing_information"]]
    if not result["missing_information"] or result["missing_information"] == [PRELIMINARY_MISSING_INFO_NOTE]:
        result["missing_information"] = [PRELIMINARY_MISSING_INFO_NOTE, *DEFAULT_MISSING_INFORMATION]
    if not result["questions_for_user_or_suppliers"]:
        result["questions_for_user_or_suppliers"] = DEFAULT_SUPPLIER_QUESTIONS

    result["base_parameters"] = sanitize_base_parameters(result)
    if isinstance(result.get("tco_dashboard_matrix"), dict):
        horizon_years = result["base_parameters"].get("horizon_years")
        if _as_number(horizon_years) is not None:
            result["tco_dashboard_matrix"]["horizon"] = f"{horizon_years} anos"
        elif _as_text(horizon_years, ""):
            result["tco_dashboard_matrix"]["horizon"] = _as_text(horizon_years)
    result["benchmark_assumptions"] = sanitize_benchmark_assumptions(result)
    result["financial_model"] = build_financial_model(result)
    result["transparency_table"] = build_transparency_table(result)
    result["scorecard"] = sanitize_scorecard(result)
    reinforce_recommendation_from_scorecard(result)
    sync_ranking_from_scorecard(result)

    if usage:
        result["tokens_input"] = usage.get("tokens_input")
        result["tokens_output"] = usage.get("tokens_output")

    return result


async def analyze_tco(
    *,
    title: str,
    item_name: str,
    analysis_type: str,
    evaluation_horizon: str,
    comparison_unit: str,
    currency: str,
    purchase_volume: str | None,
    objective: str | None,
    alternatives_json: str | None,
    general_context: str | None,
    additional_instructions: str | None,
    files: list[UploadFile],
    trace_id: str | None = None,
) -> TcoAnalysisResult:
    started_at = time.perf_counter()
    settings = get_settings()
    validate_required_fields(
        {
            "title": title,
            "item_name": item_name,
            "analysis_type": analysis_type,
            "evaluation_horizon": evaluation_horizon,
            "comparison_unit": comparison_unit or "Por compra",
            "currency": currency,
        }
    )
    fallback_alternatives = parse_alternatives_json(alternatives_json)

    written_context_values = [objective, general_context, additional_instructions]
    has_written_context = any((value or "").strip() for value in written_context_values)
    if not files and not has_written_context and not fallback_alternatives:
        raise HTTPException(
            status_code=400,
            detail="Ingresa contexto, instrucciones, datos escritos o sube documentos para generar el analisis TCO preliminar.",
        )

    if len(files) > settings.max_files_tco:
        raise HTTPException(status_code=400, detail=f"Puedes subir como maximo {settings.max_files_tco} archivos por analisis TCO.")

    temp_paths: list[Path] = []
    documents: list[dict[str, Any]] = []

    try:
        for upload in files:
            validate_allowed_file(upload.filename or "")
            temp_paths.append(await save_upload_temporarily(upload, settings.max_file_size_mb))

        for path, upload in zip(temp_paths, files):
            documents.append(build_document_summary(path, upload.filename or path.name))

        if fallback_alternatives:
            documents.append(
                {
                    "file_name": "datos escritos por el usuario",
                    "detected_type": "json",
                    "relevant_findings": [json.dumps(fallback_alternatives, ensure_ascii=False, default=str)],
                    "limitations": ["Datos manuales usados solo como respaldo del analisis, no como formulario obligatorio."],
                }
            )

        documents_for_prompt = trim_total_document_context(documents)
        logger.info(
            "tco_analysis.start traceId=%s files=%s documents=%s manualAlternatives=%s",
            trace_id or "missing",
            len(files),
            len(documents_for_prompt),
            len(fallback_alternatives),
        )
        prompt = build_user_prompt(
            title=title.strip(),
            item_name=item_name.strip(),
            analysis_type=analysis_type.strip(),
            evaluation_horizon=evaluation_horizon.strip(),
            comparison_unit=(comparison_unit or "Por compra").strip(),
            currency=currency.strip(),
            objective=objective,
            general_context=general_context,
            additional_instructions=additional_instructions,
            documents=documents_for_prompt,
        )
        image_parts = build_image_content_parts(temp_paths, files)

        try:
            raw_result = await asyncio.wait_for(
                analyze_tco_with_claude(prompt, image_parts, documents_for_prompt),
                timeout=settings.tco_model_timeout_seconds,
            )
        except TimeoutError:
            elapsed_ms = int((time.perf_counter() - started_at) * 1000)
            logger.warning(
                "tco_analysis.model_timeout traceId=%s timeoutSeconds=%s elapsedMs=%s files=%s documents=%s manualAlternatives=%s",
                trace_id or "missing",
                settings.tco_model_timeout_seconds,
                elapsed_ms,
                len(files),
                len(documents_for_prompt),
                len(fallback_alternatives),
            )
            raw_result = build_fallback_result(
                title=title,
                item_name=item_name,
                analysis_type=analysis_type,
                evaluation_horizon=evaluation_horizon,
                comparison_unit=comparison_unit or "Por compra",
                currency=currency,
                documents=documents_for_prompt,
                reason="El modelo TCO no respondio dentro del tiempo operativo.",
            )
        raw_usage = raw_result.pop("_usage", {})
        raw_model = raw_result.pop("_model", None)
        raw_result.pop("_warnings", None)

        raw_result = ensure_result_defaults(
            raw_result,
            title=title,
            item_name=item_name,
            analysis_type=analysis_type,
            evaluation_horizon=evaluation_horizon,
            comparison_unit=comparison_unit or "Por compra",
            currency=currency,
        )
        raw_result = sanitize_tco_result(raw_result)
        if raw_result.get("model_timed_out"):
            raw_result["scorecard"] = None
            raw_result["ranking"] = []
            raw_result["tco_totals"] = []
            raw_result["financial_model"] = []
            raw_result["executive_summary"] = {
                **raw_result["executive_summary"],
                "best_alternative": "No determinado",
                "best_alternative_score": None,
                "best_alternative_score_label": "No determinado",
                "why_it_wins": "No se completo el modelo TCO; no existe una recomendacion analitica final.",
                "final_recommendation": "Reintentar el analisis o completar informacion antes de decidir.",
            }
            raw_result["strategic_recommendation"] = {
                "recommended_action": "Reintentar analisis",
                "economic_option": "No determinado",
                "technical_option": "No determinado",
                "lowest_risk_option": "No determinado",
                "balanced_option": "No determinado",
                "final_recommended_option": "No determinado",
                "recommendation_rationale": "El modelo TCO no respondio dentro del tiempo operativo; no se genero ranking ni calculo financiero.",
                "negotiation_points": ["Solicitar costos, supuestos y condiciones comerciales faltantes antes de adjudicar."],
                "next_steps": ["Reintentar procesamiento", "Cambiar documento", "Agregar informacion minima"],
            }
        if (objective or "").strip():
            user_instructions = objective.strip()
            raw_result["user_priority_instructions"] = user_instructions
            base_parameters = raw_result.get("base_parameters") or {}
            notes = _as_list(base_parameters.get("notes"))
            instruction_note = f"Informacion importante/instrucciones del usuario: {user_instructions}"
            if instruction_note not in notes:
                notes.append(instruction_note)
            base_parameters["notes"] = notes
            raw_result["base_parameters"] = base_parameters
        raw_result["supporting_documents_summary"] = [
            SupportingDocumentSummary.model_validate(item).model_dump() for item in documents_for_prompt
        ]
        raw_result["document_traceability"] = documents_for_prompt
        raw_result["detected_alternatives"] = raw_result.get("detected_alternatives") or build_detected_alternatives_from_documents(documents_for_prompt)
        quality = raw_result.get("extracted_data_quality") or {}
        quality["detected_alternatives_count"] = quality.get("detected_alternatives_count") or len(raw_result.get("detected_alternatives", []))
        quality["documents_processed"] = len(files)
        quality["confidence_level"] = quality.get("confidence_level") or ("medium" if len(raw_result.get("detected_alternatives", [])) >= 2 else "low")
        quality["warnings"] = _as_list(quality.get("warnings"))
        if raw_result.get("model_timed_out"):
            quality["warnings"] = [
                *quality.get("warnings", []),
                "El motor TCO no produjo un resultado concluyente; no se genero ranking ni calculo financiero.",
            ]
            raw_result["calculation_warnings"] = [
                *_as_list(raw_result.get("calculation_warnings")),
                "Resultado bloqueado para descargables concluyentes hasta reintentar o completar informacion.",
            ]
            raw_result["downloadReadiness"] = {
                "status": "blocked",
                "reason": "El modelo TCO no respondio dentro del tiempo operativo; reintenta el analisis o agrega informacion minima.",
            }
        elif len(raw_result.get("detected_alternatives", [])) <= 1:
            quality["warnings"] = [
                *quality.get("warnings", []),
                "Analisis preliminar: se detecto una o ninguna alternativa. Para comparar TCO, agrega mas propuestas o cotizaciones.",
            ]
            raw_result["calculation_warnings"] = [
                *_as_list(raw_result.get("calculation_warnings")),
                "No hay al menos dos alternativas comparables con evidencia suficiente.",
            ]
            raw_result["downloadReadiness"] = {
                "status": "blocked",
                "reason": "Se requieren al menos dos alternativas comparables para un entregable TCO concluyente.",
            }
        else:
            raw_result["downloadReadiness"] = {
                "status": "ready_with_validation" if quality.get("warnings") else "ready",
                "reason": "El analisis tiene alternativas comparables; validar advertencias antes de decidir.",
            }
        raw_result["extracted_data_quality"] = quality
        raw_result.setdefault(
            "disclaimer",
            "Este analisis TCO es una recomendacion asistida por IA y debe ser validado por el comprador antes de tomar una decision final.",
        )
        raw_result["model_provider"] = "anthropic"
        raw_result["model_name"] = raw_model or settings.anthropic_model
        if isinstance(raw_usage, dict):
            raw_result["tokens_input"] = raw_usage.get("tokens_input")
            raw_result["tokens_output"] = raw_usage.get("tokens_output")
        raw_result["latency_ms"] = int((time.perf_counter() - started_at) * 1000)

        return TcoAnalysisResult.model_validate(raw_result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="No se pudo generar el analisis TCO.") from exc
    finally:
        if settings.delete_temp_files:
            cleanup_files(temp_paths)
