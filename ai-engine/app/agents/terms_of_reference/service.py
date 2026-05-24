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
from app.agents.terms_of_reference.schemas import ChecklistItem, DashboardMetric, FormSchemaResponse, TermsOfReferenceResult
from app.agents.terms_of_reference.template_selector import base_form_sections, get_template
from app.ai.llm_client import analyze_with_openai
from app.config import get_settings
from app.document_processing.file_detector import detect_file_type, validate_allowed_file
from app.utils.temp_files import cleanup_files, save_upload_temporarily

TERMS_MAX_FILES = 8
REDUNDANT_FORM_FIELDS = {
    "problem_to_solve",
    "expected_benefit",
    "non_execution_risk",
    "areas_or_equipment",
    "allowed_hours",
    "supplier_conditions_extra",
    "compliance_notes",
    "requesting_area",
    "request_owner",
    "justification",
}


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
    compact_sections: list[dict[str, Any]] = []
    has_observations = False
    for section in raw["form_sections"]:
        fields = []
        for field in section.get("fields", []):
            name = field.get("name")
            if name in REDUNDANT_FORM_FIELDS:
                continue
            if name == "important_observations":
                has_observations = True
            fields.append(field)
        if fields:
            compact_sections.append({**section, "fields": fields[:6]})

    for section in compact_sections:
        normalized_title = (section.get("section_title") or "").lower()
        if "objetivo" in normalized_title and not has_observations:
            section["fields"].append(
                {
                    "name": "important_observations",
                    "label": "Observaciones importantes",
                    "type": "textarea",
                    "required": False,
                    "placeholder": "Agrega riesgos, restricciones, condiciones criticas, antecedentes, urgencia, impactos o puntos que el proveedor debe considerar.",
                    "options": [],
                }
            )
            has_observations = True
            break

    raw["form_sections"] = compact_sections

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
    title = payload["title"]
    tender_process = [
        "Validar termino de referencia",
        "Seleccionar proveedores invitados",
        "Enviar correo de invitacion",
        "Recibir consultas",
        "Responder consultas",
        "Recibir propuestas",
        "Comparar propuestas",
        "Negociar si aplica",
        "Seleccionar proveedor",
        "Emitir orden de compra o contrato",
    ]
    return {
        "title": title,
        "requirement_type": payload["requirement_type"],
        "category": payload["category"],
        "template_used": payload.get("category") or "Otro",
        "executive_summary": f"Termino de referencia para {title}, orientado a cubrir el alcance indicado por el comprador.",
        "generated_document": {
            "general_data": {
                "requirement_name": title,
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
        "completion_score": 80,
        "completion_level": "Alta",
        "risk_level": "Medio",
        "checklist": [],
        "flow_steps": ["Necesidad", "Alcance", "Actividades", "Entregables", "Requisitos", "Proveedor"],
        "dashboard_metrics": [],
        "tender_bases": {
            "object": f"Convocar proveedores para {title}.",
            "scope": payload["scope"],
            "minimum_supplier_requirements": [
                "Experiencia relacionada con el alcance solicitado.",
                "Capacidad tecnica y recursos suficientes para ejecutar el requerimiento.",
                "Cumplimiento de requisitos de seguridad y acceso definidos por el comprador.",
            ],
            "requested_documentation": template["documents"],
            "evaluation_criteria": ["Cumplimiento tecnico", "Precio total", "Plazo", "Garantia", "Experiencia", "Condiciones comerciales"],
            "proposal_submission_conditions": ["Presentar propuesta tecnica y economica", "Indicar exclusiones", "Adjuntar cronograma y garantia"],
            "question_deadline": "No especificado",
            "proposal_deadline": "No especificado",
            "submission_method": "No especificado",
            "award_criteria": ["Mejor cumplimiento tecnico-economico validado por compras y area usuaria."],
            "disqualification_conditions": ["No presentar informacion tecnica minima", "No cumplir requisitos criticos de seguridad", "Presentar informacion incompleta no subsanada"],
            "buyer_observations": ["Validar estas bases con compras, legal o responsable interno antes del envio."],
            "disclaimer": "Estas bases son una guia inicial y deben ser revisadas por el area de compras, legal o responsable interno antes de enviarse.",
        },
        "supplier_invitation_email": {
            "subject": f"Invitacion a presentar propuesta - {title}",
            "greeting": "Estimados proveedores,",
            "body": f"Los invitamos a presentar su propuesta tecnica y economica para {title}. Adjuntamos el termino de referencia y documentos de apoyo disponibles para su revision.",
            "attached_documents": ["Termino de referencia", *template["documents"]],
            "response_deadline": "No especificado",
            "contact_details": "No especificado",
            "closing": "Saludos cordiales,",
        },
        "tender_process": tender_process,
        "disclaimer": "Este documento fue generado con asistencia de IA y debe ser revisado por el comprador antes de enviarse a proveedores.",
    }


def _completion_level(score: int) -> str:
    if score >= 80:
        return "Alta"
    if score >= 55:
        return "Media"
    return "Baja"


def _risk_level(score: int, missing_count: int) -> str:
    if score < 55 or missing_count >= 5:
        return "Alto"
    if score < 80 or missing_count:
        return "Medio"
    return "Bajo"


def _enhance_result(result: TermsOfReferenceResult) -> TermsOfReferenceResult:
    document = result.generated_document
    checks = [
        ("Objetivo definido", bool(document.objective.strip()), "Completar objetivo de la contratacion."),
        ("Alcance definido", bool(document.scope.strip()), "Completar alcance y limites del requerimiento."),
        ("Actividades definidas", bool(document.required_activities), "Agregar actividades requeridas o validar si no aplica."),
        ("Entregables definidos", bool(document.final_deliverables), "Agregar entregables esperados."),
        ("Justificacion incluida", bool(document.justification.strip()), "Agregar justificacion del requerimiento."),
        ("Requisitos de seguridad revisados", bool(document.safety_requirements), "Validar requisitos SST/SSMA aplicables."),
        ("Documentos de apoyo adjuntos", bool(result.supporting_documents_summary), "Adjuntar planos, fotos, fichas o documentos si existen."),
        ("Informacion faltante identificada", bool(result.missing_information), "Revisar informacion faltante antes del envio."),
        ("Condiciones para proveedor definidas", bool(document.supplier_conditions), "Agregar condiciones de presentacion o ejecucion."),
        ("Anexos sugeridos incluidos", bool(document.suggested_annexes), "Validar anexos sugeridos."),
    ]

    if not result.checklist:
        result.checklist = [
            ChecklistItem(
                label=label,
                status="complete" if complete else ("recommended" if "Documentos" in label else "incomplete"),
                detail=None if complete else detail,
            )
            for label, complete, detail in checks
        ]

    completed = sum(1 for _, complete, _ in checks if complete)
    score = round((completed / len(checks)) * 100)
    if not result.completion_score:
        result.completion_score = score
        result.completion_level = _completion_level(result.completion_score)  # type: ignore[assignment]
        result.risk_level = _risk_level(result.completion_score, len(result.missing_information))  # type: ignore[assignment]

    if not result.flow_steps:
        result.flow_steps = ["Necesidad", "Alcance", "Actividades", "Entregables", "Requisitos", "Proveedor"]

    if not result.dashboard_metrics:
        result.dashboard_metrics = [
            DashboardMetric(label="Completitud", value=result.completion_level, status="complete" if result.completion_score >= 80 else "warning"),
            DashboardMetric(label="Riesgo informacion faltante", value=result.risk_level, status="risk" if result.risk_level == "Alto" else "warning" if result.risk_level == "Medio" else "complete"),
            DashboardMetric(label="Detalle tecnico", value="Alto" if len(document.technical_characteristics) >= 4 else "Medio" if document.technical_characteristics else "Bajo", status="neutral"),
            DashboardMetric(label="Seguridad requerida", value="Si" if document.safety_requirements and "No aplica" not in document.safety_requirements else "No aplica", status="warning" if document.safety_requirements and "No aplica" not in document.safety_requirements else "neutral"),
            DashboardMetric(label="Documentos cargados", value=str(len(result.supporting_documents_summary)), status="complete" if result.supporting_documents_summary else "neutral"),
            DashboardMetric(label="Entregables definidos", value=str(len(document.final_deliverables)), status="complete" if document.final_deliverables else "risk"),
            DashboardMetric(label="Requisitos criticos", value=str(len(document.safety_requirements)), status="warning" if document.safety_requirements else "neutral"),
        ]

    if not result.tender_process:
        result.tender_process = [
            "Validar termino de referencia",
            "Seleccionar proveedores invitados",
            "Enviar correo de invitacion",
            "Recibir consultas",
            "Responder consultas",
            "Recibir propuestas",
            "Comparar propuestas",
            "Negociar si aplica",
            "Seleccionar proveedor",
            "Emitir orden de compra o contrato",
        ]

    if result.tender_bases.object == "No especificado":
        result.tender_bases.object = f"Convocar proveedores para {result.title}."
    if result.tender_bases.scope == "No especificado":
        result.tender_bases.scope = document.scope or "No especificado"
    if not result.tender_bases.requested_documentation:
        result.tender_bases.requested_documentation = document.suggested_annexes or ["Termino de referencia"]
    if not result.tender_bases.evaluation_criteria:
        result.tender_bases.evaluation_criteria = ["Cumplimiento tecnico", "Precio total", "Plazo", "Garantia", "Experiencia"]

    if result.supplier_invitation_email.body == "No especificado":
        result.supplier_invitation_email.subject = f"Invitacion a presentar propuesta - {result.title}"
        result.supplier_invitation_email.body = (
            f"Los invitamos a presentar su propuesta tecnica y economica para {result.title}. "
            "Adjuntamos el termino de referencia y documentos disponibles para su revision."
        )
        result.supplier_invitation_email.attached_documents = ["Termino de referencia", *document.suggested_annexes]

    return result


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
    justification: str | None,
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
        derived_justification = (
            (justification or "").strip()
            or str(parsed_dynamic.get("important_observations") or "").strip()
            or f"El requerimiento se sustenta en la necesidad descrita por el comprador: {initial_description.strip()}"
        )
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
            "justification": derived_justification,
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
        result = _enhance_result(result)
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
