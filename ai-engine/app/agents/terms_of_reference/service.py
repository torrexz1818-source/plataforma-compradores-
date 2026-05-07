import json
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile

from app.agents.terms_of_reference.document_builder import extract_supporting_document, split_lines
from app.agents.terms_of_reference.prompts import (
    FORM_SCHEMA_SYSTEM_PROMPT,
    GENERATE_SYSTEM_PROMPT,
    build_form_schema_prompt,
    build_generate_prompt,
)
from app.agents.terms_of_reference.quality_validator import validate_quality
from app.agents.terms_of_reference.schemas import FormSchemaResponse, TermsOfReferenceResult
from app.agents.terms_of_reference.template_selector import base_form_sections, get_template
from app.ai.llm_client import analyze_with_openai
from app.config import get_settings
from app.document_processing.file_detector import detect_file_type, validate_allowed_file
from app.utils.temp_files import cleanup_files, save_upload_temporarily

TERMS_MAX_FILES = 8


def _parse_json_field(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Uno de los campos JSON enviados no es valido.") from exc


def _normalize_form_schema(raw: dict[str, Any], initial_description: str) -> FormSchemaResponse:
    category = raw.get("detected_category") or "Otro"
    template = get_template(category)
    raw.setdefault("detected_category", category)
    raw.setdefault("requirement_type", "Servicio")
    raw.setdefault("complexity", "medium")
    raw.setdefault("recommended_template", category)
    raw.setdefault("form_sections", base_form_sections(category))
    raw.setdefault("recommended_safety_requirements", template["safety"])
    raw.setdefault("suggested_documents", template["documents"])
    raw.setdefault("notes_for_buyer", [])

    if len(initial_description.split()) < 5:
        raw["notes_for_buyer"].append(
            "La descripcion inicial es breve. Completa objetivo, alcance, cantidades, ubicacion y restricciones antes de generar el documento."
        )

    return FormSchemaResponse.model_validate(raw)


async def create_form_schema(initial_description: str) -> FormSchemaResponse:
    initial_description = initial_description.strip()
    if len(initial_description) < 10:
        raise HTTPException(status_code=400, detail="Describe primero que necesitas realizar.")

    base_sections = base_form_sections()
    prompt = build_form_schema_prompt(initial_description, base_sections)
    raw = await analyze_with_openai(prompt, FORM_SCHEMA_SYSTEM_PROMPT)
    return _normalize_form_schema(raw, initial_description)


def _fallback_document(payload: dict[str, Any], document_summaries: list[dict[str, Any]]) -> dict[str, Any]:
    template = get_template(payload.get("category"))
    return {
        "title": payload["title"],
        "requirement_type": payload["requirement_type"],
        "category": payload["category"],
        "template_used": payload.get("category") or "Otro",
        "executive_summary": f"Termino de referencia para {payload['title']}, orientado a cubrir el alcance indicado por el comprador.",
        "generated_document": {
            "general_data": {
                "requirement_name": payload["title"],
                "requirement_type": payload["requirement_type"],
                "category": payload["category"],
                "location": payload.get("location"),
                "required_date": payload.get("required_date"),
            },
            "objective": payload["objective"],
            "scope": payload["scope"],
            "technical_characteristics": template["fields"],
            "required_activities": split_lines(payload.get("activities")) or ["Ejecutar las actividades descritas en el alcance validando condiciones en campo."],
            "final_deliverables": split_lines(payload.get("deliverables")),
            "justification": payload["justification"],
            "safety_requirements": payload.get("safety_requirements") or template["safety"],
            "supplier_conditions": [
                "El proveedor debera validar medidas, cantidades y condiciones antes de presentar su propuesta final.",
                "El proveedor debera incluir cronograma, recursos asignados, garantia y exclusiones.",
                "El proveedor debera cumplir los requisitos internos de seguridad y acceso definidos por el comprador.",
            ],
            "final_report_structure": ["Resumen de actividades", "Registro fotografico", "Hallazgos", "Recomendaciones", "Conformidad del servicio"],
            "budget_chain": payload["budget_chain"],
            "suggested_annexes": template["documents"],
            "additional_observations": split_lines(payload.get("additional_instructions")),
        },
        "supporting_documents_summary": document_summaries,
        "missing_information": ["Validar cantidades finales, fechas exactas, responsable interno y condiciones particulares de la instalacion."],
        "buyer_recommendations": ["Revisar el documento con el area usuaria y SST/SSMA antes de enviarlo a proveedores."],
        "quality_check": {"is_complete": True, "warnings": [], "missing_sections": []},
        "disclaimer": "Este documento fue generado con asistencia de IA y debe ser revisado por el comprador antes de enviarse a proveedores.",
    }


async def generate_terms_of_reference(
    *,
    initial_description: str,
    title: str,
    requirement_type: str,
    category: str,
    location: str | None,
    required_date: str | None,
    objective: str,
    scope: str,
    activities: str | None,
    deliverables: str,
    justification: str,
    safety_requirements: str | None,
    budget_project: str | None,
    budget_cost_center: str | None,
    budget_account: str | None,
    budget_reference: str | None,
    currency: str | None,
    additional_instructions: str | None,
    dynamic_form_data: str | None,
    files: list[UploadFile],
) -> TermsOfReferenceResult:
    settings = get_settings()
    required = {
        "initial_description": initial_description,
        "title": title,
        "requirement_type": requirement_type,
        "objective": objective,
        "scope": scope,
        "deliverables": deliverables,
        "justification": justification,
    }
    missing = [name for name, value in required.items() if not value or not value.strip()]
    if missing:
        raise HTTPException(status_code=400, detail=f"Completa los campos obligatorios: {', '.join(missing)}.")

    if len(files) > TERMS_MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Puedes subir como maximo {TERMS_MAX_FILES} archivos de apoyo.")

    temp_paths: list[Path] = []
    document_context: list[dict[str, Any]] = []
    document_summaries: list[dict[str, Any]] = []

    try:
        for upload in files:
            validate_allowed_file(upload.filename or "")
            temp_paths.append(await save_upload_temporarily(upload, settings.max_file_size_mb))

        print(
            "terms_of_reference_generation_started",
            {"file_count": len(files), "file_types": [detect_file_type(file.filename or "") for file in files]},
        )

        for path, upload in zip(temp_paths, files):
            context, summary = extract_supporting_document(path, upload.filename or path.name)
            document_context.append(context)
            document_summaries.append(summary.model_dump())

        parsed_safety = _parse_json_field(safety_requirements, [])
        parsed_dynamic = _parse_json_field(dynamic_form_data, {})
        budget_chain = {
            "project": budget_project or None,
            "cost_center": budget_cost_center or None,
            "account": budget_account or None,
            "budget_reference": budget_reference or None,
            "currency": currency or None,
        }
        payload = {
            "initial_description": initial_description,
            "title": title,
            "requirement_type": requirement_type,
            "category": category or "Otro",
            "location": location,
            "required_date": required_date,
            "objective": objective,
            "scope": scope,
            "activities": activities,
            "deliverables": deliverables,
            "justification": justification,
            "safety_requirements": parsed_safety,
            "budget_chain": budget_chain,
            "additional_instructions": additional_instructions,
            "dynamic_form_data": parsed_dynamic,
            "template": get_template(category),
            "supporting_documents": document_context,
        }

        try:
            raw = await analyze_with_openai(build_generate_prompt(payload), GENERATE_SYSTEM_PROMPT)
        except HTTPException:
            raise
        except Exception:
            raw = _fallback_document(payload, document_summaries)

        raw.setdefault("supporting_documents_summary", document_summaries)
        raw.setdefault("disclaimer", "Este documento fue generado con asistencia de IA y debe ser revisado por el comprador antes de enviarse a proveedores.")

        result = TermsOfReferenceResult.model_validate(raw)
        result = validate_quality(result)
        print("terms_of_reference_generation_completed", {"file_count": len(files)})
        return result
    except HTTPException:
        raise
    except Exception as exc:
        print("terms_of_reference_generation_failed", {"file_count": len(files)})
        raise HTTPException(
            status_code=502,
            detail="No se pudo generar el termino de referencia. Verifica la configuracion del AI Engine y vuelve a intentar.",
        ) from exc
    finally:
        if settings.delete_temp_files:
            cleanup_files(temp_paths)
