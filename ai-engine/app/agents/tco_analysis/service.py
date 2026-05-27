from __future__ import annotations

import base64
import json
import mimetypes
import time
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile
from openai import AsyncOpenAI, OpenAIError

from app.agents.tco_analysis.prompts import SYSTEM_PROMPT, build_user_prompt
from app.agents.tco_analysis.quality_validator import validate_alternatives, validate_required_fields
from app.agents.tco_analysis.schemas import SupportingDocumentSummary, TcoAnalysisResult
from app.agents.tco_analysis.sensitivity import build_sensitivity_from_totals
from app.ai.json_utils import parse_json_response
from app.config import get_settings
from app.document_processing.document_reader import read_document_text
from app.document_processing.file_detector import detect_file_type, validate_allowed_file
from app.utils.temp_files import cleanup_files, save_upload_temporarily

MAX_DOCUMENT_CONTEXT_CHARS = 12000
MAX_TOTAL_DOCUMENT_CONTEXT_CHARS = 60000
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
        limitations.append("Se envio al LLM un contexto documental priorizado por terminos relevantes para TCO.")
    if len(compact) > MAX_DOCUMENT_CONTEXT_CHARS:
        compact = compact[:MAX_DOCUMENT_CONTEXT_CHARS]
        limitations.append("El contexto documental fue truncado para proteger rendimiento y privacidad.")

    return compact, limitations


def build_document_summary(path: Path, filename: str) -> dict[str, Any]:
    file_type = detect_file_type(filename)
    try:
        text, detected_file_type, warnings = read_document_text(path, filename)
        file_type = detected_file_type or file_type
    except Exception:
        text = ""
        warnings = ["No se pudo extraer texto del archivo; se enviaron metadatos y, si aplica, la imagen al LLM."]

    compact, limitations = compact_text_for_tco(text)
    return {
        "file_name": filename,
        "detected_type": file_type,
        "relevant_findings": [compact] if compact else [],
        "limitations": [*warnings, *limitations],
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
                "El contexto textual total fue truncado para mantener el analisis dentro del limite del modelo.",
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
        parts.append({"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{encoded}"}})
    return parts


async def analyze_tco_with_openai(user_prompt: str, image_parts: list[dict[str, Any]]) -> dict[str, Any]:
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY no esta configurada en el AI Engine.")

    user_content: str | list[dict[str, Any]] = user_prompt
    if image_parts:
        user_content = [{"type": "text", "text": user_prompt}, *image_parts]

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
        )
    except OpenAIError as exc:
        raise HTTPException(status_code=502, detail="OpenAI no pudo procesar el analisis TCO en este momento.") from exc

    content = response.choices[0].message.content or ""
    try:
        result = parse_json_response(content)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="OpenAI devolvio una respuesta TCO que no es JSON valido.") from exc

    usage = getattr(response, "usage", None)
    if usage:
        result["_usage"] = {
            "tokens_input": getattr(usage, "prompt_tokens", None),
            "tokens_output": getattr(usage, "completion_tokens", None),
        }
    return result


def build_fallback_result(
    *,
    title: str,
    item_name: str,
    analysis_type: str,
    evaluation_horizon: str,
    comparison_unit: str,
    currency: str,
    documents: list[dict[str, Any]],
) -> dict[str, Any]:
    detected = build_detected_alternatives_from_documents(documents) if documents else []
    best = detected[0]["supplier_name"] if detected else "No determinado"

    return {
        "analysis_title": title,
        "item_name": item_name,
        "analysis_type": analysis_type,
        "evaluation_horizon": evaluation_horizon,
        "comparison_unit": comparison_unit,
        "currency": currency,
        "executive_summary": {
            "best_alternative": best,
            "best_alternative_score": 60,
            "best_alternative_score_label": "Regular",
            "why_it_wins": "Fallback tecnico construido con la informacion disponible. OpenAI no completo el analisis, por lo que no existe una recomendacion analitica final.",
            "estimated_saving_or_overcost": "No determinado",
            "main_risk": "Analisis no completado por indisponibilidad del modelo o error temporal.",
            "final_recommendation": "No adjudicar con este fallback. Reintentar el analisis y pedir informacion faltante antes de decidir.",
        },
        "data_used": [],
        "tco_matrix": [
            {
                "cost_component": "TCO total estimado",
                "values": {best: "No especificado"} if detected else {},
                "notes": PRELIMINARY_MISSING_INFO_NOTE,
            }
        ],
        "tco_totals": [],
        "ranking": [
            {
                "position": 1,
                "alternative": best,
                "ranking_type": "Mejor alternativa estrategica",
                "total_tco": None,
                "score": 60,
                "score_label": "Regular",
                "score_breakdown": {
                    "tco_cost_score": 50,
                    "risk_score": 55,
                    "warranty_support_score": 60,
                    "availability_lead_time_score": 60,
                    "data_confidence_score": 40,
                    "weighted_formula": "35% TCO/costo, 25% riesgo, 20% garantia/soporte, 10% disponibilidad/lead time, 10% confianza de informacion",
                },
                "source_basis": ["Analisis preliminar sin montos numericos completos."],
                "reason": "Ranking fallback no concluyente. No hay interpretacion avanzada ni suficientes datos numericos para ordenar por menor TCO.",
            }
        ] if detected else [],
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
            "recommendation_rationale": "No se completo el analisis con OpenAI; este fallback no debe usarse como recomendacion final.",
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
            "warnings": ["OpenAI no estuvo disponible; se genero un fallback tecnico basico que no reemplaza el analisis TCO completo."]
            if documents
            else [],
        },
        "calculation_warnings": ["No se ejecuto calculo rigido previo; el flujo TCO es LLM-first."],
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

    if len(files) > 8:
        raise HTTPException(status_code=400, detail="Puedes subir como maximo 8 archivos por analisis TCO.")

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
                    "limitations": ["Datos manuales usados solo como fallback interno, no como formulario obligatorio."],
                }
            )

        documents_for_prompt = trim_total_document_context(documents)
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
            raw_result = await analyze_tco_with_openai(prompt, image_parts)
        except HTTPException as exc:
            if exc.status_code >= 500:
                raw_result = build_fallback_result(
                    title=title,
                    item_name=item_name,
                    analysis_type=analysis_type,
                    evaluation_horizon=evaluation_horizon,
                    comparison_unit=comparison_unit or "Por compra",
                    currency=currency,
                    documents=documents_for_prompt,
                )
            else:
                raise

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
        raw_result["supporting_documents_summary"] = [
            SupportingDocumentSummary.model_validate(item).model_dump() for item in documents_for_prompt
        ]
        raw_result["detected_alternatives"] = raw_result.get("detected_alternatives") or build_detected_alternatives_from_documents(documents_for_prompt)
        quality = raw_result.get("extracted_data_quality") or {}
        quality["detected_alternatives_count"] = quality.get("detected_alternatives_count") or len(raw_result.get("detected_alternatives", []))
        quality["documents_processed"] = len(files)
        quality["confidence_level"] = quality.get("confidence_level") or ("medium" if len(raw_result.get("detected_alternatives", [])) >= 2 else "low")
        quality["warnings"] = _as_list(quality.get("warnings"))
        if len(raw_result.get("detected_alternatives", [])) <= 1:
            quality["warnings"] = [
                *quality.get("warnings", []),
                "Analisis preliminar: se detecto una o ninguna alternativa. Para comparar TCO, agrega mas propuestas o cotizaciones.",
            ]
        raw_result["extracted_data_quality"] = quality
        raw_result.setdefault(
            "disclaimer",
            "Este analisis TCO es una recomendacion asistida por IA y debe ser validado por el comprador antes de tomar una decision final.",
        )
        raw_result["model_provider"] = "OpenAI"
        raw_result["model_name"] = settings.openai_model
        raw_result["latency_ms"] = int((time.perf_counter() - started_at) * 1000)

        return TcoAnalysisResult.model_validate(raw_result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="No se pudo generar el analisis TCO.") from exc
    finally:
        if settings.delete_temp_files:
            cleanup_files(temp_paths)
