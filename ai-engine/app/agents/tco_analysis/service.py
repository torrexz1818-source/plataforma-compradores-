from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile

from app.agents.tco_analysis.calculator import calculate_tco, merge_calculations
from app.agents.tco_analysis.prompts import SYSTEM_PROMPT, build_user_prompt
from app.agents.tco_analysis.quality_validator import validate_alternatives, validate_required_fields
from app.agents.tco_analysis.schemas import SupportingDocumentSummary, TcoAnalysisResult
from app.agents.tco_analysis.sensitivity import build_sensitivity_from_totals
from app.ai.llm_client import analyze_with_openai
from app.config import get_settings
from app.document_processing.document_reader import read_document_text
from app.document_processing.file_detector import detect_file_type, validate_allowed_file
from app.utils.temp_files import cleanup_files, save_upload_temporarily

MAX_DOCUMENT_CONTEXT_CHARS = 3500
RELEVANT_TERMS = (
    "precio", "fob", "cif", "exw", "flete", "seguro", "aduana", "impuesto", "arancel",
    "garantía", "garantia", "mantenimiento", "repuesto", "instalación", "instalacion",
    "capacitación", "capacitacion", "soporte", "vida útil", "vida util", "lead time",
    "plazo", "pago", "condiciones", "exclusiones", "riesgo", "consumo", "energía",
    "energia", "transporte", "penalidad", "contrato", "licencia", "suscripción",
)


def parse_alternatives_json(alternatives_json: str) -> list[dict[str, Any]]:
    try:
        parsed = json.loads(alternatives_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="alternatives_json no es JSON válido.") from exc
    return validate_alternatives(parsed)


def compact_text_for_tco(text: str) -> tuple[str, list[str]]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    relevant = [
        line for line in lines
        if any(term in line.lower() for term in RELEVANT_TERMS)
    ]
    selected = relevant[:80] if relevant else lines[:80]
    compact = "\n".join(selected)
    limitations: list[str] = []

    if len(text) > len(compact):
        limitations.append("Se envió al LLM un contexto documental compacto con términos relevantes para TCO.")
    if len(compact) > MAX_DOCUMENT_CONTEXT_CHARS:
        compact = compact[:MAX_DOCUMENT_CONTEXT_CHARS]
        limitations.append("El contexto documental fue truncado para evitar enviar documentos completos.")

    return compact, limitations


def build_document_summary(path: Path, filename: str) -> dict[str, Any]:
    text, file_type, warnings = read_document_text(path, filename)
    compact, limitations = compact_text_for_tco(text)
    return {
        "file_name": filename,
        "detected_type": file_type,
        "relevant_findings": [compact] if compact else [],
        "limitations": [*warnings, *limitations],
    }


def build_fallback_result(
    *,
    title: str,
    item_name: str,
    analysis_type: str,
    evaluation_horizon: str,
    comparison_unit: str,
    currency: str,
    alternatives: list[dict[str, Any]],
    documents: list[dict[str, Any]],
    calculation_warnings: list[str],
) -> dict[str, Any]:
    matrix, totals, ranking, warnings = calculate_tco(alternatives, evaluation_horizon)
    sensitivity = build_sensitivity_from_totals(totals)
    best = ranking[0]["alternative"] if ranking else "No determinado"

    return {
        "analysis_title": title,
        "item_name": item_name,
        "analysis_type": analysis_type,
        "evaluation_horizon": evaluation_horizon,
        "comparison_unit": comparison_unit,
        "currency": currency,
        "executive_summary": {
            "best_alternative": best,
            "why_it_wins": "Resultado calculado con los montos numéricos disponibles. Falta interpretación avanzada de OpenAI.",
            "estimated_saving_or_overcost": "No determinado" if len(ranking) < 2 else "Ver ranking TCO calculado.",
            "main_risk": "Información incompleta",
            "final_recommendation": "Validar datos faltantes antes de adjudicar.",
        },
        "data_used": [
            {
                "alternative": item["supplier_name"],
                "base_price": str(item.get("base_price")) if item.get("base_price") is not None else None,
                "quantity": str(item.get("quantity")) if item.get("quantity") is not None else None,
                "currency": str(item.get("currency") or currency),
                "horizon": evaluation_horizon,
                "origin": item.get("origin_country"),
                "destination": item.get("destination_country"),
                "incoterm": item.get("incoterm"),
                "lead_time": item.get("lead_time"),
                "key_assumptions": [],
            }
            for item in alternatives
        ],
        "tco_matrix": matrix,
        "tco_totals": totals,
        "ranking": ranking,
        "interpretation": {
            "why_winner_wins": "El ganador se define por menor TCO calculable con datos disponibles.",
            "hidden_costs": [],
            "cheap_but_risky_options": [],
            "expensive_but_convenient_options": [],
            "conditions_that_change_decision": ["Completar costos faltantes puede cambiar el ranking."],
        },
        "risk_analysis": [],
        "sensitivity_analysis": sensitivity,
        "strategic_recommendation": {
            "recommended_action": "Pedir más información",
            "negotiation_points": ["Solicitar desglose de costos ocultos, garantía, soporte y lead time."],
            "next_steps": ["Completar costos faltantes y validar condiciones comerciales."],
        },
        "missing_information": ["Completar cualquier costo no informado por proveedor."],
        "questions_for_user_or_suppliers": ["¿Qué costos de mantenimiento, operación, garantía y soporte aplican por alternativa?"],
        "assumptions_and_limits": ["No se inventaron impuestos, aranceles ni tipo de cambio."],
        "supporting_documents_summary": documents,
        "calculation_warnings": [*calculation_warnings, *warnings],
        "disclaimer": "Este análisis TCO es una recomendación asistida por IA y debe ser validado por el comprador antes de tomar una decisión final.",
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
            "why_it_wins": "Falta información para definir una alternativa ganadora.",
            "estimated_saving_or_overcost": "No determinado",
            "main_risk": "Información incompleta",
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
            "recommended_action": "Pedir más información",
            "negotiation_points": [],
            "next_steps": [],
        },
    )
    result.setdefault("data_used", [])
    result.setdefault("tco_matrix", [])
    result.setdefault("tco_totals", [])
    result.setdefault("ranking", [])
    result.setdefault("risk_analysis", [])
    result.setdefault("missing_information", [])
    result.setdefault("questions_for_user_or_suppliers", [])
    result.setdefault("assumptions_and_limits", [])
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
    alternatives_json: str,
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
            "comparison_unit": comparison_unit,
            "currency": currency,
        }
    )
    alternatives = parse_alternatives_json(alternatives_json)

    if len(files) > 8:
        raise HTTPException(status_code=400, detail="Puedes subir como máximo 8 archivos por análisis TCO.")

    temp_paths: list[Path] = []
    documents: list[dict[str, Any]] = []

    try:
        for upload in files:
            validate_allowed_file(upload.filename or "")
            temp_paths.append(await save_upload_temporarily(upload, settings.max_file_size_mb))

        for path, upload in zip(temp_paths, files):
            documents.append(build_document_summary(path, upload.filename or path.name))

        matrix, totals, ranking, calculation_warnings = calculate_tco(alternatives, evaluation_horizon)
        python_calculations = {
            "tco_matrix": matrix,
            "tco_totals": totals,
            "ranking": ranking,
            "sensitivity_analysis": build_sensitivity_from_totals(totals),
            "calculation_warnings": calculation_warnings,
        }
        prompt = build_user_prompt(
            title=title.strip(),
            item_name=item_name.strip(),
            analysis_type=analysis_type.strip(),
            evaluation_horizon=evaluation_horizon.strip(),
            comparison_unit=comparison_unit.strip(),
            currency=currency.strip(),
            purchase_volume=purchase_volume,
            objective=objective,
            alternatives=alternatives,
            additional_instructions=additional_instructions,
            documents=documents,
            python_calculations=python_calculations,
        )

        try:
            raw_result = await analyze_with_openai(prompt, SYSTEM_PROMPT)
        except HTTPException as exc:
            if exc.status_code >= 500:
                raw_result = build_fallback_result(
                    title=title,
                    item_name=item_name,
                    analysis_type=analysis_type,
                    evaluation_horizon=evaluation_horizon,
                    comparison_unit=comparison_unit,
                    currency=currency,
                    alternatives=alternatives,
                    documents=documents,
                    calculation_warnings=calculation_warnings,
                )
            else:
                raise

        raw_result = ensure_result_defaults(
            raw_result,
            title=title,
            item_name=item_name,
            analysis_type=analysis_type,
            evaluation_horizon=evaluation_horizon,
            comparison_unit=comparison_unit,
            currency=currency,
        )
        raw_result["supporting_documents_summary"] = [
            SupportingDocumentSummary.model_validate(item).model_dump() for item in documents
        ]
        raw_result = merge_calculations(raw_result, alternatives, evaluation_horizon)
        raw_result["sensitivity_analysis"] = build_sensitivity_from_totals(raw_result.get("tco_totals", []))
        raw_result.setdefault(
            "disclaimer",
            "Este análisis TCO es una recomendación asistida por IA y debe ser validado por el comprador antes de tomar una decisión final.",
        )
        raw_result["model_provider"] = "OpenAI"
        raw_result["model_name"] = settings.openai_model
        raw_result["latency_ms"] = int((time.perf_counter() - started_at) * 1000)

        return TcoAnalysisResult.model_validate(raw_result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="No se pudo generar el análisis TCO.",
        ) from exc
    finally:
        if settings.delete_temp_files:
            cleanup_files(temp_paths)
