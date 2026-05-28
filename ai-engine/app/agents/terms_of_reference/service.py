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

TDR_TYPES = {
    "software": "Software / tecnologia",
    "sistema": "Software / tecnologia",
    "saas": "Software / tecnologia",
    "plataforma": "Software / tecnologia",
    "obra": "Obra civil",
    "acondicionamiento": "Obra civil",
    "construccion": "Obra civil",
    "civil": "Obra civil",
    "mantenimiento": "Servicio especializado",
    "correctivo": "Servicio especializado",
    "preventivo": "Servicio especializado",
    "aire acondicionado": "Servicio especializado",
    "laptop": "Bien o producto",
    "equipo": "Bien o producto",
    "compra": "Bien o producto",
    "bien": "Bien o producto",
    "producto": "Bien o producto",
    "consultoria": "Consultoria",
    "consultoría": "Consultoria",
    "asesoria": "Consultoria",
    "homologacion": "Consultoria",
    "limpieza": "Servicio simple",
}

DOCUMENT_REQUESTS = {
    "solo tdr": ("Solo TDR", ["TDR"]),
    "tdr": ("Solo TDR", ["TDR"]),
    "termino de referencia": ("Solo TDR", ["TDR"]),
    "término de referencia": ("Solo TDR", ["TDR"]),
    "bases": ("Solo Bases del Concurso", ["Bases del Concurso"]),
    "bases del concurso": ("Solo Bases del Concurso", ["Bases del Concurso"]),
    "invitacion": ("Solo Invitacion a postores", ["Invitacion a postores"]),
    "invitación": ("Solo Invitacion a postores", ["Invitacion a postores"]),
    "correo": ("Solo Invitacion a postores", ["Invitacion a postores"]),
    "carta": ("Solo Invitacion a postores", ["Invitacion a postores"]),
    "cronograma": ("Solo Cronograma", ["Cronograma"]),
    "calendario": ("Solo Cronograma", ["Cronograma"]),
}

PACKAGE_KEYWORDS = ("paquete", "todo", "todos", "proceso completo", "concurso completo", "documentos para concurso", "documentos de contratacion")

PACKAGE_DOCUMENTS = ["TDR", "Bases del Concurso", "Invitacion a postores", "Cronograma"]


def _detect_tdr_type(*values: str | None) -> str:
    text = " ".join(value or "" for value in values).lower()
    for keyword, tdr_type in TDR_TYPES.items():
        if keyword in text:
            return tdr_type
    if "servicio" in text:
        return "Servicio simple"
    return "Servicio simple"


def _detect_document_request(*values: str | None) -> tuple[str, list[str]]:
    text = " ".join(value or "" for value in values).lower()
    if any(keyword in text for keyword in PACKAGE_KEYWORDS):
        return "Paquete completo", PACKAGE_DOCUMENTS.copy()
    matches: list[tuple[str, list[str]]] = []
    for keyword, request in DOCUMENT_REQUESTS.items():
        if keyword in text:
            matches.append(request)
    if not matches:
        return "Paquete completo", PACKAGE_DOCUMENTS.copy()
    documents: list[str] = []
    request_names = {match[0] for match in matches}
    for _, match_docs in matches:
        documents.extend(match_docs)
    unique_documents = list(dict.fromkeys(documents))
    if len(unique_documents) > 1:
        return "Paquete completo", PACKAGE_DOCUMENTS.copy()
    return next(iter(request_names)), unique_documents


def _build_process_schedule() -> list[dict[str, Any]]:
    rows = [
        ("1", "FASE 1 - Convocatoria y consultas", "Emision de invitacion y envio de TDR, bases y cronograma", "Compras", "[SUGERIDO] Dia 1", "[SUGERIDO] Dia 1", "[SUGERIDO] 1 dia", "Invitacion enviada", "Usar fecha real si ya fue definida."),
        ("2", "FASE 1 - Convocatoria y consultas", "Confirmacion de participacion de postores", "Postores invitados", "[SUGERIDO] Dia 1", "[SUGERIDO] Dia 3", "[SUGERIDO] 3 dias habiles", "Confirmaciones recibidas", "Plazo referencial permitido por buenas practicas."),
        ("3", "FASE 1 - Convocatoria y consultas", "Visita tecnica, si aplica", "Area solicitante / Postores", "[COMPLETAR] Fecha de visita", "[COMPLETAR] Fecha de visita", "[SUGERIDO] 1 dia", "Acta o registro de visita", "Marcar No aplica si no corresponde."),
        ("4", "FASE 1 - Convocatoria y consultas", "Recepcion de consultas", "Postores invitados", "[SUGERIDO] Dia 4", "[SUGERIDO] Dia 11", "[SUGERIDO] 8 dias habiles", "Consultas recibidas", ""),
        ("5", "FASE 1 - Convocatoria y consultas", "Absolucion de consultas", "Compras / Area solicitante", "[SUGERIDO] Dia 12", "[SUGERIDO] Dia 13", "[SUGERIDO] 2 dias habiles", "Circular de respuestas", ""),
        ("6", "FASE 2 - Presentacion y evaluacion", "Presentacion de propuestas", "Postores invitados", "[SUGERIDO] Dia 14", "[SUGERIDO] Dia 21", "[SUGERIDO] 8 dias calendario", "Propuestas recibidas", ""),
        ("7", "FASE 2 - Presentacion y evaluacion", "Evaluacion tecnica y subsanaciones", "Comite evaluador", "[SUGERIDO] Dia 22", "[SUGERIDO] Dia 26", "[SUGERIDO] 5 dias calendario", "Acta tecnica", "Puntaje minimo tecnico sugerido: 60% del maximo tecnico."),
        ("8", "FASE 2 - Presentacion y evaluacion", "Apertura y evaluacion economica", "Compras", "[SUGERIDO] Dia 27", "[SUGERIDO] Dia 28", "[SUGERIDO] 2 dias calendario", "Cuadro comparativo", ""),
        ("9", "FASE 3 - Resultado y adjudicacion", "Publicacion de resultado y comunicacion al ganador", "Compras", "[SUGERIDO] Dia 29", "[SUGERIDO] Dia 29", "[SUGERIDO] 1 dia", "Resultado comunicado", ""),
        ("10", "FASE 3 - Resultado y adjudicacion", "Adjudicacion y firma de contrato u orden de compra", "Compras / Legal", "[SUGERIDO] Dia 30", "[SUGERIDO] Dia 35", "[SUGERIDO] 5 dias calendario", "Contrato u OC emitida", ""),
        ("11", "FASE 4 - Inicio de ejecucion", "Entrega de garantias, seguros y documentos previos", "Proveedor adjudicado", "[COMPLETAR] Antes del inicio", "[COMPLETAR] Antes del inicio", "[SUGERIDO] 2 dias", "Documentos habilitantes", ""),
        ("12", "FASE 4 - Inicio de ejecucion", "Acta de inicio e inicio de ejecucion", "Area solicitante / Proveedor", "[COMPLETAR] Fecha de inicio", "[COMPLETAR] Fecha de inicio", "[SUGERIDO] 1 dia", "Acta de inicio", ""),
    ]
    return [
        {
            "number": number,
            "phase": phase,
            "activity": activity,
            "responsible": responsible,
            "start": start,
            "end": end,
            "duration": duration,
            "deliverable": deliverable,
            "observations": observations,
        }
        for number, phase, activity, responsible, start, end, duration, deliverable, observations in rows
    ]


def _evaluation_matrix_for_type(tdr_type: str) -> list[dict[str, Any]]:
    matrices = {
        "Software / tecnologia": [
            ("Tecnico", "Cobertura de requerimientos funcionales y no funcionales", 35, "Matriz de cumplimiento, propuesta tecnica y arquitectura propuesta."),
            ("Seguridad y continuidad", "Seguridad, disponibilidad, respaldo, soporte y SLA", 20, "Plan de seguridad, SLA, soporte y mantenimiento."),
            ("Experiencia", "Implementaciones similares y equipo asignado", 15, "Casos similares, CVs y referencias."),
            ("Economico", "Costo total y condiciones comerciales", 20, "Propuesta economica detallada."),
            ("Implementacion", "Cronograma, pruebas UAT y capacitacion", 10, "Plan de trabajo, plan de pruebas y plan de capacitacion."),
        ],
        "Obra civil": [
            ("Tecnico", "Alcance tecnico, metodologia, partidas y control de calidad", 35, "Memoria tecnica, cronograma y plan de calidad."),
            ("Seguridad", "Plan de seguridad y salud aplicable", 15, "Documentacion SST y procedimientos de trabajo seguro."),
            ("Experiencia", "Experiencia en obras similares y equipo tecnico", 20, "Constancias, CVs y referencias."),
            ("Economico", "Presupuesto y analisis de precios", 20, "Propuesta economica desagregada."),
            ("Plazo y garantia", "Cronograma, garantia y condiciones de recepcion", 10, "Cronograma y carta de garantia."),
        ],
        "Bien o producto": [
            ("Tecnico", "Cumplimiento de ficha tecnica, calidad y compatibilidad", 35, "Ficha tecnica, catalogo o muestras si aplican."),
            ("Garantia y soporte", "Garantia, reposicion y soporte postventa", 20, "Carta de garantia y condiciones de soporte."),
            ("Experiencia", "Capacidad de suministro y referencias", 10, "Ordenes o constancias similares."),
            ("Economico", "Precio total, impuestos y condiciones de pago", 25, "Propuesta economica detallada."),
            ("Entrega", "Plazo, embalaje y condiciones de entrega", 10, "Cronograma de entrega y condiciones logisticas."),
        ],
        "Consultoria": [
            ("Metodologia", "Enfoque, plan de trabajo y transferencia de conocimiento", 35, "Propuesta metodologica y plan de trabajo."),
            ("Equipo consultor", "Perfil, experiencia y dedicacion del equipo", 25, "CVs y experiencia especifica."),
            ("Entregables", "Calidad, aplicabilidad y criterios de aceptacion", 15, "Modelo de entregables y cronograma."),
            ("Economico", "Honorarios y condiciones comerciales", 15, "Propuesta economica."),
            ("Confidencialidad", "Gestion de informacion y cumplimiento de confidencialidad", 10, "Declaracion o acuerdo de confidencialidad."),
        ],
        "Servicio especializado": [
            ("Tecnico", "Metodologia, recursos, herramientas y alcance tecnico", 35, "Propuesta tecnica y plan de trabajo."),
            ("Experiencia", "Experiencia especifica y personal calificado", 20, "Constancias, CVs, certificaciones si aplican."),
            ("SLA y calidad", "Niveles de servicio, reportes y control de calidad", 15, "SLA, indicadores y formato de reporte."),
            ("Economico", "Costo total y condiciones comerciales", 20, "Propuesta economica detallada."),
            ("Seguridad", "Protocolos de seguridad y acceso", 10, "Procedimientos y documentacion SST si aplica."),
        ],
        "Servicio simple": [
            ("Alcance operativo", "Cobertura del servicio, frecuencia, dotacion e insumos", 35, "Propuesta tecnica y plan operativo."),
            ("Calidad y supervision", "Supervision, reportes y niveles de servicio", 20, "Plan de supervision e indicadores."),
            ("Experiencia", "Experiencia en servicios similares", 15, "Referencias o constancias."),
            ("Economico", "Precio total y condiciones comerciales", 20, "Propuesta economica."),
            ("Seguridad", "Protocolos basicos de seguridad y acceso", 10, "Procedimientos o declaracion de cumplimiento."),
        ],
    }
    return [
        {"criterion": criterion, "subcriterion": subcriterion, "score": score, "required_evidence": evidence}
        for criterion, subcriterion, score, evidence in matrices.get(tdr_type, matrices["Servicio simple"])
    ]


def _required_documents_for_type(tdr_type: str, template_documents: list[str]) -> list[str]:
    common = ["Propuesta tecnica", "Propuesta economica", "Experiencia del proveedor", "Cronograma de ejecucion", "Garantias aplicables"]
    by_type = {
        "Software / tecnologia": ["Requerimientos funcionales cubiertos", "Plan de implementacion", "SLA y soporte", "Plan de pruebas UAT", "Documentacion tecnica"],
        "Obra civil": ["Memoria tecnica", "Plan de seguridad y salud", "Cronograma de obra", "Plan de calidad", "Garantia de ejecucion"],
        "Bien o producto": ["Ficha tecnica", "Catalogo o muestra si aplica", "Condiciones de entrega", "Carta de garantia", "Soporte postventa"],
        "Consultoria": ["Propuesta metodologica", "Plan de trabajo", "CV del equipo consultor", "Casos similares", "Compromiso de confidencialidad"],
        "Servicio especializado": ["Metodologia de ejecucion", "Certificaciones si aplican", "Plan de trabajo", "SLA o indicadores", "Formatos de reporte"],
        "Servicio simple": ["Plan operativo", "Dotacion e insumos", "Frecuencia del servicio", "Plan de supervision", "Protocolos de seguridad"],
    }
    return list(dict.fromkeys([*common, *by_type.get(tdr_type, []), *template_documents]))


def _guarantees_for_type(tdr_type: str) -> list[dict[str, Any]]:
    by_type = {
        "Software / tecnologia": [
            ("Garantia", "[SUGERIDO] Soporte para correccion de incidencias posteriores a la puesta en produccion."),
            ("Penalidad", "[SUGERIDO] Penalidad por incumplimiento de SLA o hitos criticos, previa validacion legal."),
            ("Condicion comercial", "[COMPLETAR] Definir licenciamiento, renovaciones, mantenimiento y forma de pago."),
        ],
        "Obra civil": [
            ("Garantia", "[SUGERIDO] Garantia por calidad de ejecucion y correccion de observaciones de recepcion."),
            ("Penalidad", "[SUGERIDO] Penalidad por retrasos injustificados, previa validacion legal."),
            ("Condicion comercial", "[COMPLETAR] Definir valorizaciones, adelantos, retenciones y conformidad."),
        ],
        "Bien o producto": [
            ("Garantia", "[SUGERIDO] Garantia por defectos de fabricacion, reposicion o cambio segun corresponda."),
            ("Penalidad", "[SUGERIDO] Penalidad por entrega tardia o incumplimiento de especificaciones."),
            ("Condicion comercial", "[COMPLETAR] Definir forma de pago, lugar de entrega, impuestos y validez de oferta."),
        ],
    }
    default = [
        ("Garantia", "[SUGERIDO] Garantia de calidad del servicio y correccion de observaciones."),
        ("Penalidad", "[SUGERIDO] Penalidad por incumplimiento de niveles de servicio o cronograma, previa validacion legal."),
        ("Condicion comercial", "[COMPLETAR] Definir forma de pago, conformidad, impuestos y validez de oferta."),
    ]
    return [{"type": item_type, "item": item_type, "condition": condition, "status": "[COMPLETAR]" if "[COMPLETAR]" in condition else "[SUGERIDO]"} for item_type, condition in by_type.get(tdr_type, default)]


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
    tdr_type = payload.get("tdr_type") or _detect_tdr_type(
        payload.get("requirement_type"),
        payload.get("category"),
        title,
        payload.get("initial_description"),
        payload.get("objective"),
        payload.get("scope"),
        payload.get("additional_instructions"),
    )
    evaluation_matrix = _evaluation_matrix_for_type(tdr_type)
    required_documents = _required_documents_for_type(tdr_type, template["documents"])
    document_request = payload.get("document_request") or "Paquete completo"
    generated_documents = payload.get("generated_documents") or PACKAGE_DOCUMENTS.copy()
    process_code = payload.get("process_code") or "[COMPLETAR: codigo del proceso]"
    contracting_entity = payload.get("contracting_entity") or {}
    process_schedule = _build_process_schedule()
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
        "document_request": document_request,
        "generated_documents": generated_documents,
        "process_code": process_code,
        "contracting_entity": {
            "business_name": contracting_entity.get("business_name") or "[COMPLETAR: razon social de la entidad convocante]",
            "tax_id": contracting_entity.get("tax_id") or "[COMPLETAR: RUC o identificacion tributaria]",
            "address": contracting_entity.get("address") or "[COMPLETAR: direccion]",
            "institutional_contact": contracting_entity.get("institutional_contact") or "[COMPLETAR: correo o web institucional]",
            "process_owner": contracting_entity.get("process_owner") or "[COMPLETAR: responsable del proceso]",
            "requesting_area": contracting_entity.get("requesting_area") or payload.get("requesting_area") or "[COMPLETAR: area solicitante]",
        },
        "invited_bidders": [
            {
                "contact_name": "{nombre_contacto}",
                "business_name": "{razon_social}",
                "role": "{cargo}",
                "email": "{correo}",
            }
        ],
        "executive_summary": f"{document_request} para {title}, orientado a cubrir el alcance indicado por el comprador y mantener coherencia entre documentos del proceso.",
        "generated_document": {
            "general_data": {
                "requirement_name": title,
                "requirement_type": payload["requirement_type"],
                "category": payload["category"],
                "location": payload.get("location"),
                "required_date": payload.get("required_date"),
            },
            "tdr_type": tdr_type,
            "background": payload.get("additional_instructions")
            or f"Requerimiento originado a partir de la necesidad descrita por el comprador: {payload['initial_description']}",
            "objective": payload["objective"],
            "scope": payload["scope"],
            "technical_characteristics": [f"[SUGERIDO] {item}" for item in template["fields"]],
            "required_activities": split_lines(payload.get("activities")) or ["Ejecutar las actividades descritas en el alcance validando condiciones en campo."],
            "final_deliverables": split_lines(payload.get("deliverables")),
            "required_documents": required_documents,
            "applicable_standards": ["[COMPLETAR] Normas tecnicas, estandares internos o marco aplicable segun el tipo de requerimiento."],
            "suggested_schedule": [
                f"Fecha o plazo estimado: {payload.get('required_date') or '[COMPLETAR]'}",
                "[SUGERIDO] Validar cronograma final con el usuario interno y el proveedor adjudicado.",
            ],
            "execution_conditions": [
                "[SUGERIDO] Ejecutar el servicio conforme al alcance aprobado y con coordinacion previa con el area solicitante.",
                "[COMPLETAR] Definir horarios, accesos, restricciones operativas y responsable de conformidad.",
            ],
            "justification": payload["justification"],
            "safety_requirements": payload.get("safety_requirements") or template["safety"],
            "supplier_conditions": [
                "El proveedor debera validar medidas, cantidades y condiciones antes de presentar su propuesta final.",
                "El proveedor debera incluir cronograma, recursos asignados, garantia y exclusiones.",
                "El proveedor debera cumplir los requisitos internos de seguridad y acceso definidos por el comprador.",
            ],
            "commercial_conditions": [
                "[SUGERIDO] Solicitar propuesta tecnica y economica separada.",
                "[SUGERIDO] Solicitar condiciones de pago, garantia, validez de oferta y exclusiones.",
            ],
            "evaluation_criteria": [
                f"{item['criterion']} - {item['subcriterion']} ({item['score']} puntos)"
                for item in evaluation_matrix
            ],
            "evaluation_matrix": evaluation_matrix,
            "compliance_matrix": [
                {
                    "requirement": "Cumplimiento del alcance tecnico",
                    "type": "Tecnico",
                    "expected_evidence": "Propuesta tecnica, cronograma y declaracion de cumplimiento.",
                    "mandatory": "Obligatorio",
                    "status": "Por validar",
                },
                {
                    "requirement": "Entregables definidos",
                    "type": "Operativo",
                    "expected_evidence": "Listado de entregables y formato de conformidad.",
                    "mandatory": "Obligatorio",
                    "status": "Por validar" if split_lines(payload.get("deliverables")) else "[COMPLETAR]",
                },
            ],
            "identified_risks": [
                {
                    "risk": "Informacion tecnica incompleta o no validada en campo.",
                    "impact": "Medio",
                    "mitigation": "Recomendacion sugerida: realizar visita tecnica o ronda de consultas antes de recibir propuestas.",
                }
            ],
            "guarantees_penalties": _guarantees_for_type(tdr_type),
            "final_report_structure": ["Resumen de actividades", "Registro fotografico", "Hallazgos", "Recomendaciones", "Conformidad del servicio"],
            "budget_chain": payload["budget_chain"],
            "suggested_annexes": template["documents"],
            "additional_observations": split_lines(payload.get("additional_instructions")),
        },
        "supporting_documents_summary": document_summaries,
        "missing_information": ["[COMPLETAR] Validar cantidades finales, fechas exactas, presupuesto referencial, responsable interno y condiciones particulares de ejecucion."],
        "buyer_recommendations": ["Revisar el documento con el area usuaria y SST/SSMA antes de enviarlo a proveedores."],
        "recommended_questions": [
            "Que cantidades, ubicaciones o equipos exactos deben considerarse?",
            "Cual es el presupuesto referencial o rango aprobado?",
            "Que fechas, horarios o restricciones operativas debe cumplir el proveedor?",
            "Que documentos internos, normas o politicas deben adjuntarse?",
            "Quien sera responsable de validar la conformidad del entregable?",
        ],
        "consistency_validation": [
            "Se genero un borrador util con datos disponibles.",
            f"Documentos generados: {', '.join(generated_documents)}.",
            f"Codigo de proceso usado: {process_code}.",
            "Los datos criticos no informados fueron marcados con [COMPLETAR].",
            "Las recomendaciones inferidas fueron marcadas con [SUGERIDO].",
            "La matriz de evaluacion suma 100 puntos.",
        ],
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
            "question_deadline": "[SUGERIDO] Dia 11 del proceso",
            "proposal_deadline": "[SUGERIDO] Dia 21 del proceso",
            "submission_method": "[COMPLETAR: correo, mesa de partes o plataforma de recepcion]",
            "award_criteria": ["Mejor cumplimiento tecnico-economico validado por compras y area usuaria."],
            "disqualification_conditions": ["No presentar informacion tecnica minima", "No cumplir requisitos criticos de seguridad", "Presentar informacion incompleta no subsanada"],
            "buyer_observations": ["Validar estas bases con compras, legal o responsable interno antes del envio."],
            "disclaimer": "Estas bases son una guia inicial y deben ser revisadas por el area de compras, legal o responsable interno antes de enviarse.",
        },
        "supplier_invitation_email": {
            "subject": f"Invitacion a presentar propuesta - {title}",
            "greeting": "Estimados proveedores,",
            "body": f"Por medio de la presente, invitamos a {{razon_social}} a participar en el proceso {process_code} para {title}. Adjuntamos los documentos generados para su revision. La participacion, consultas y presentacion de propuestas deberan seguir las reglas indicadas en las bases y el cronograma.",
            "attached_documents": generated_documents,
            "response_deadline": "[SUGERIDO] Confirmar participacion dentro de 3 dias habiles.",
            "contact_details": "[COMPLETAR: responsable, correo y telefono del proceso]",
            "closing": "Saludos cordiales,",
        },
        "process_schedule": process_schedule,
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


def _normalize_evaluation_matrix(matrix: list[dict[str, Any]], tdr_type: str) -> list[dict[str, Any]]:
    normalized = []
    for item in matrix:
        score = item.get("score") or item.get("points") or item.get("puntaje") or 0
        try:
            score_number = int(round(float(score)))
        except (TypeError, ValueError):
            score_number = 0
        normalized.append(
            {
                "criterion": item.get("criterion") or item.get("criterio") or item.get("category") or "Criterio",
                "subcriterion": item.get("subcriterion") or item.get("subcriterio") or item.get("description") or item.get("detalle") or "Por validar",
                "score": max(score_number, 0),
                "required_evidence": item.get("required_evidence") or item.get("evidence") or item.get("evidencia") or "Evidencia por validar.",
            }
        )

    if not normalized:
        normalized = _evaluation_matrix_for_type(tdr_type)

    total = sum(int(item["score"]) for item in normalized)
    if total != 100:
        if total <= 0:
            normalized = _evaluation_matrix_for_type(tdr_type)
        else:
            adjusted = []
            running = 0
            for index, item in enumerate(normalized):
                if index == len(normalized) - 1:
                    score = max(100 - running, 0)
                else:
                    score = round((int(item["score"]) / total) * 100)
                    running += score
                adjusted.append({**item, "score": score})
            normalized = adjusted
            delta = 100 - sum(int(item["score"]) for item in normalized)
            if normalized:
                normalized[-1]["score"] = int(normalized[-1]["score"]) + delta

    return normalized


def _enhance_result(result: TermsOfReferenceResult) -> TermsOfReferenceResult:
    document = result.generated_document
    request_name, request_documents = _detect_document_request(
        result.document_request,
        result.title,
        result.requirement_type,
        result.category,
        document.objective,
        document.scope,
    )
    if not result.generated_documents:
        result.generated_documents = request_documents
    if result.document_request == "Paquete completo" and result.generated_documents != PACKAGE_DOCUMENTS:
        result.document_request = request_name
    if not result.document_request:
        result.document_request = request_name
    if not result.process_code:
        result.process_code = "[COMPLETAR: codigo del proceso]"
    if not result.contracting_entity:
        result.contracting_entity = {}
    result.contracting_entity = {
        "business_name": result.contracting_entity.get("business_name") or "[COMPLETAR: razon social de la entidad convocante]",
        "tax_id": result.contracting_entity.get("tax_id") or "[COMPLETAR: RUC o identificacion tributaria]",
        "address": result.contracting_entity.get("address") or "[COMPLETAR: direccion]",
        "institutional_contact": result.contracting_entity.get("institutional_contact") or "[COMPLETAR: correo o web institucional]",
        "process_owner": result.contracting_entity.get("process_owner") or "[COMPLETAR: responsable del proceso]",
        "requesting_area": result.contracting_entity.get("requesting_area") or "[COMPLETAR: area solicitante]",
    }
    if not result.invited_bidders:
        result.invited_bidders = [
            {
                "contact_name": "{nombre_contacto}",
                "business_name": "{razon_social}",
                "role": "{cargo}",
                "email": "{correo}",
            },
            {
                "contact_name": "[COMPLETAR: ingresar empresas invitadas]",
                "business_name": "[COMPLETAR: razon social]",
                "role": "[COMPLETAR: cargo]",
                "email": "[COMPLETAR: correo]",
            },
        ]
    if not result.process_schedule:
        result.process_schedule = _build_process_schedule()

    document.tdr_type = _detect_tdr_type(
        document.tdr_type,
        result.requirement_type,
        result.category,
        result.title,
        document.objective,
        document.scope,
    )
    template = get_template(result.category)
    document.required_documents = document.required_documents or _required_documents_for_type(document.tdr_type, template["documents"])
    document.evaluation_matrix = _normalize_evaluation_matrix(document.evaluation_matrix, document.tdr_type)
    document.evaluation_criteria = document.evaluation_criteria or [
        f"{item['criterion']} - {item['subcriterion']} ({item['score']} puntos)"
        for item in document.evaluation_matrix
    ]
    if not any("[SUGERIDO]" in item or "[COMPLETAR]" in item for item in [*document.commercial_conditions, *document.suggested_schedule, *result.missing_information]):
        result.missing_information.append("[COMPLETAR] Validar presupuesto referencial, responsables, fechas exactas y restricciones especificas antes de publicar el TDR.")

    if not document.applicable_standards:
        document.applicable_standards = [
            "[COMPLETAR] Normas tecnicas, estandares internos, politicas de seguridad o marco aplicable al requerimiento."
        ]
    if not document.execution_conditions:
        document.execution_conditions = [
            "[SUGERIDO] Coordinar accesos, horarios, responsables y restricciones operativas antes del inicio.",
            "[SUGERIDO] Validar conformidad contra entregables y evidencias objetivas.",
        ]
    if not document.guarantees_penalties:
        document.guarantees_penalties = _guarantees_for_type(document.tdr_type)

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

    if not document.background.strip() or document.background == "No especificado":
        document.background = "Dato no especificado"

    if not document.suggested_schedule:
        document.suggested_schedule = [
            f"Fecha o plazo estimado: {document.general_data.required_date or 'Dato no especificado'}",
            "Recomendacion sugerida: confirmar cronograma de ejecucion, hitos y fecha de inicio antes de enviar la solicitud a proveedores.",
        ]

    if not document.commercial_conditions:
        document.commercial_conditions = [
            "Recomendacion sugerida: solicitar propuesta tecnica y economica separada.",
            "Recomendacion sugerida: pedir validez de oferta, garantia, forma de pago, exclusiones e impuestos aplicables.",
        ]

    if not document.evaluation_criteria:
        document.evaluation_criteria = result.tender_bases.evaluation_criteria or [
            "Cumplimiento tecnico",
            "Precio total",
            "Plazo de ejecucion",
            "Garantia",
            "Experiencia del proveedor",
            "Condiciones comerciales",
        ]

    if not document.compliance_matrix:
        document.compliance_matrix = [
            {
                "requirement": "Objetivo y alcance comprendidos",
                "type": "Tecnico",
                "expected_evidence": "Declaracion de cumplimiento y propuesta tecnica.",
                "mandatory": "Obligatorio",
                "status": "Por validar" if document.objective and document.scope else "[COMPLETAR]",
            },
            {
                "requirement": "Especificaciones tecnicas cubiertas",
                "type": "Tecnico",
                "expected_evidence": "Ficha tecnica, memoria descriptiva, catalogo o detalle de solucion.",
                "mandatory": "Obligatorio",
                "status": "Por validar" if document.technical_characteristics else "[COMPLETAR]",
            },
            {
                "requirement": "Entregables comprometidos",
                "type": "Operativo",
                "expected_evidence": "Listado de entregables, formato de conformidad y plazo.",
                "mandatory": "Obligatorio",
                "status": "Por validar" if document.final_deliverables else "[COMPLETAR]",
            },
            {
                "requirement": "Requisitos de seguridad y acceso",
                "type": "Seguridad",
                "expected_evidence": "Documentacion SST/SSMA, permisos o constancias aplicables.",
                "mandatory": "Deseable",
                "status": "Por validar",
            },
        ]

    if not document.identified_risks:
        document.identified_risks = [
            {
                "risk": "Datos tecnicos, cantidades o condiciones de ejecucion pendientes de validacion.",
                "impact": "Medio",
                "mitigation": "Recomendacion sugerida: validar informacion con el area usuaria y solicitar visita tecnica si aplica.",
            }
        ]

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
        result.tender_bases.requested_documentation = document.required_documents or document.suggested_annexes or ["Termino de referencia"]
    if not result.tender_bases.evaluation_criteria:
        result.tender_bases.evaluation_criteria = [
            f"{item['criterion']} ({item['score']} puntos): {item['subcriterion']}"
            for item in document.evaluation_matrix
        ]

    if not result.recommended_questions:
        result.recommended_questions = [
            "Que cantidades, ubicaciones o equipos exactos deben considerarse?",
            "Cual es el presupuesto referencial o rango aprobado?",
            "Que fechas, horarios o restricciones operativas debe cumplir el proveedor?",
            "Que documentos internos, normas o politicas deben adjuntarse?",
            "Quien sera responsable de validar la conformidad del entregable?",
        ]
    if not result.consistency_validation:
        result.consistency_validation = [
            f"Documentos generados: {', '.join(result.generated_documents)}.",
            f"Codigo de proceso usado de forma transversal: {result.process_code}.",
            "Criterios de evaluacion normalizados a 100 puntos.",
            "Datos criticos faltantes marcados para completar o validar.",
        ]

    if result.supplier_invitation_email.body == "No especificado":
        result.supplier_invitation_email.subject = f"Invitacion a presentar propuesta - {result.title}"
        result.supplier_invitation_email.body = (
            f"Por medio de la presente, invitamos a {{razon_social}} a participar en el proceso {result.process_code} para {result.title}. "
            "Adjuntamos los documentos generados para su revision y solicitamos confirmar participacion dentro del plazo indicado."
        )
        result.supplier_invitation_email.attached_documents = result.generated_documents

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
        tdr_type = _detect_tdr_type(requirement_type, category, title, initial_description, objective, scope, additional_instructions)
        document_request, generated_documents = _detect_document_request(
            initial_description,
            title,
            requirement_type,
            category,
            objective,
            scope,
            additional_instructions,
            json.dumps(parsed_dynamic, ensure_ascii=False),
        )
        payload = {
            "initial_description": initial_description,
            "title": title,
            "requirement_type": requirement_type,
            "category": category or "Otro",
            "tdr_type": tdr_type,
            "document_request": document_request,
            "generated_documents": generated_documents,
            "process_code": str(parsed_dynamic.get("process_code") or parsed_dynamic.get("codigo_proceso") or "").strip() or "[COMPLETAR: codigo del proceso]",
            "contracting_entity": {
                "business_name": str(parsed_dynamic.get("business_name") or parsed_dynamic.get("razon_social") or "").strip(),
                "tax_id": str(parsed_dynamic.get("tax_id") or parsed_dynamic.get("ruc") or "").strip(),
                "address": str(parsed_dynamic.get("address") or parsed_dynamic.get("direccion") or "").strip(),
                "institutional_contact": str(parsed_dynamic.get("institutional_contact") or parsed_dynamic.get("correo_institucional") or "").strip(),
                "process_owner": str(parsed_dynamic.get("process_owner") or parsed_dynamic.get("responsable") or "").strip(),
                "requesting_area": str(parsed_dynamic.get("requesting_area") or parsed_dynamic.get("area_solicitante") or "").strip(),
            },
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
