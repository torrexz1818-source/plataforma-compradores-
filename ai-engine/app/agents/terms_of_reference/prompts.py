import json
from typing import Any

FORM_SCHEMA_SYSTEM_PROMPT = """
Actua como especialista senior en compras corporativas.
Lee la descripcion inicial del comprador y determina que tipo de requerimiento quiere crear.
Debes clasificar la categoria, detectar el tipo de requerimiento, seleccionar una plantilla recomendada y generar o ajustar un formulario detallado.
El formulario debe ser inteligente y depender de lo que el comprador quiere comprar, contratar o solicitar; evita preguntas irrelevantes.
Divide el formulario en pocos pasos claros y conserva solo campos minimos corporativos para que el documento final sea completo.
El formulario debe ser corto: evita pedir el mismo dato dos veces y no separes problema, beneficio e impacto en campos distintos.
Usa un solo campo llamado "Observaciones importantes" para riesgos, restricciones, antecedentes, impactos, urgencias o notas criticas.
Incluye campos especificos segun la categoria, ejemplos en placeholders, requisitos tecnicos, entregables, seguridad sugerida y documentos de apoyo recomendados.
No generes todavia el termino de referencia final.
Si la descripcion es vaga, genera un formulario base y agrega preguntas sugeridas en notes_for_buyer.
Devuelve exclusivamente JSON valido con las claves solicitadas.
"""

GENERATE_SYSTEM_PROMPT = """
Actua como especialista senior en compras, abastecimiento y elaboracion de terminos de referencia para procesos de contratacion B2B.
Genera un documento profesional en espanol a partir de la descripcion inicial, categoria, formulario completado, documentos de apoyo, instrucciones adicionales y plantilla seleccionada.
El documento debe estar orientado a uso corporativo.
Incluye como minimo datos generales, objetivo, alcance, caracteristicas tecnicas, actividades requeridas, entregables, justificacion, requisitos SST/SSMA, condiciones para proveedores, estructura de informe final si aplica, cadena presupuestal si aplica, anexos sugeridos, informacion faltante y recomendaciones para el comprador.
Ademas genera apoyo operativo para compras: bases sugeridas para licitacion o solicitud de propuestas, correo sugerido para invitar proveedores y proceso sugerido de licitacion.
Reglas: no inventes datos especificos; usa "No especificado" cuando un dato no este disponible; si falta informacion, agregala en informacion faltante o puntos por validar; mejora la redaccion tecnica; usa tono corporativo claro y profesional; adapta el documento al tipo de servicio o compra; sugiere requisitos de seguridad razonables indicando que deben ser validados por el comprador.
Las bases de licitacion y el correo son una guia inicial operativa, no documentos legales definitivos, y deben incluir advertencia de revision interna/legal cuando aplique.
Si hay documentos de apoyo, usalos como contexto. Si hay planos o fichas tecnicas, extrae medidas, cantidades, equipos o condiciones relevantes cuando sea posible. Si hay fotos o anexos, usalos para reforzar la justificacion, alcance o anexos sugeridos.
Devuelve exclusivamente JSON valido. No devuelvas markdown fuera del JSON.
"""


def build_form_schema_prompt(initial_description: str, base_sections: list[dict[str, Any]]) -> str:
    return json.dumps(
        {
            "task": "Clasificar requerimiento y generar formulario inteligente",
            "initial_description": initial_description,
            "allowed_categories": [
                "Mantenimiento electrico / luminarias",
                "Reparacion de infraestructura",
                "Aire acondicionado",
                "Limpieza",
                "Senalizacion / estacionamiento",
                "Compra de bienes",
                "Servicio recurrente",
                "Consultoria",
                "Obra menor",
                "Seguridad patrimonial",
                "Otro",
            ],
            "required_output_shape": {
                "detected_category": "string",
                "requirement_type": "string",
                "complexity": "low|medium|high",
                "recommended_template": "string",
                "form_sections": base_sections,
                "recommended_safety_requirements": ["string"],
                "suggested_documents": ["string"],
                "notes_for_buyer": ["string"],
            },
        },
        ensure_ascii=False,
    )


def build_generate_prompt(payload: dict[str, Any]) -> str:
    return json.dumps(
        {
            "task": "Generar termino de referencia corporativo",
            "required_output_shape": {
                "title": "string",
                "requirement_type": "string",
                "category": "string",
                "template_used": "string",
                "executive_summary": "string",
                "generated_document": {
                    "general_data": {
                        "requirement_name": "string",
                        "requirement_type": "string",
                        "category": "string",
                        "location": "string|null",
                        "required_date": "string|null",
                    },
                    "objective": "string",
                    "scope": "string",
                    "technical_characteristics": ["string"],
                    "required_activities": ["string"],
                    "final_deliverables": ["string"],
                    "justification": "string",
                    "safety_requirements": ["string"],
                    "supplier_conditions": ["string"],
                    "final_report_structure": ["string"],
                    "budget_chain": {
                        "project": "string|null",
                        "cost_center": "string|null",
                        "account": "string|null",
                        "budget_reference": "string|null",
                        "currency": "string|null",
                    },
                    "suggested_annexes": ["string"],
                    "additional_observations": ["string"],
                },
                "supporting_documents_summary": [
                    {
                        "file_name": "string",
                        "detected_type": "string",
                        "relevant_findings": ["string"],
                        "limitations": ["string"],
                    }
                ],
                "missing_information": ["string"],
                "buyer_recommendations": ["string"],
                "quality_check": {
                    "is_complete": True,
                    "warnings": ["string"],
                    "missing_sections": ["string"],
                },
                "completion_score": 0,
                "completion_level": "Alta|Media|Baja",
                "risk_level": "Bajo|Medio|Alto",
                "checklist": [
                    {"label": "string", "status": "complete|incomplete|recommended", "detail": "string|null"}
                ],
                "flow_steps": ["Necesidad", "Alcance", "Actividades", "Entregables", "Requisitos", "Proveedor"],
                "dashboard_metrics": [
                    {"label": "string", "value": "string", "status": "complete|warning|risk|neutral", "detail": "string|null"}
                ],
                "tender_bases": {
                    "object": "string",
                    "scope": "string",
                    "minimum_supplier_requirements": ["string"],
                    "requested_documentation": ["string"],
                    "evaluation_criteria": ["string"],
                    "proposal_submission_conditions": ["string"],
                    "question_deadline": "string",
                    "proposal_deadline": "string",
                    "submission_method": "string",
                    "award_criteria": ["string"],
                    "disqualification_conditions": ["string"],
                    "buyer_observations": ["string"],
                    "disclaimer": "Estas bases son una guia inicial y deben ser revisadas por el area de compras, legal o responsable interno antes de enviarse.",
                },
                "supplier_invitation_email": {
                    "subject": "string",
                    "greeting": "string",
                    "body": "string",
                    "attached_documents": ["string"],
                    "response_deadline": "string",
                    "contact_details": "string",
                    "closing": "string",
                },
                "tender_process": ["string"],
                "disclaimer": "Este documento fue generado con asistencia de IA y debe ser revisado por el comprador antes de enviarse a proveedores.",
            },
            "input": payload,
        },
        ensure_ascii=False,
    )
