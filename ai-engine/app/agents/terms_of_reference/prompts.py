import json
from typing import Any

FORM_SCHEMA_SYSTEM_PROMPT = """
Actua como especialista senior en compras corporativas.
Lee la descripcion inicial del comprador y determina que tipo de requerimiento quiere crear.
Debes clasificar la categoria, detectar el tipo de requerimiento, seleccionar una plantilla recomendada y generar un formulario detallado.
Incluye campos especificos segun la categoria, requisitos de seguridad sugeridos y documentos de apoyo recomendados.
No generes todavia el termino de referencia final.
Si la descripcion es vaga, genera un formulario base y agrega preguntas sugeridas en notes_for_buyer.
Devuelve exclusivamente JSON valido con las claves solicitadas.
"""

GENERATE_SYSTEM_PROMPT = """
Actua como especialista senior en compras, abastecimiento y elaboracion de terminos de referencia para procesos de contratacion B2B.
Genera un documento profesional en espanol a partir de la descripcion inicial, categoria, formulario completado, documentos de apoyo, instrucciones adicionales y plantilla seleccionada.
El documento debe estar orientado a uso corporativo.
Incluye como minimo datos generales, objetivo, alcance, caracteristicas tecnicas, actividades requeridas, entregables, justificacion, requisitos SST/SSMA, condiciones para proveedores, estructura de informe final si aplica, cadena presupuestal si aplica, anexos sugeridos, informacion faltante y recomendaciones para el comprador.
Reglas: no inventes datos especificos; si falta informacion, agregala en informacion faltante o puntos por validar; mejora la redaccion tecnica; usa tono corporativo claro y profesional; adapta el documento al tipo de servicio o compra; sugiere requisitos de seguridad razonables indicando que deben ser validados por el comprador.
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
                "disclaimer": "Este documento fue generado con asistencia de IA y debe ser revisado por el comprador antes de enviarse a proveedores.",
            },
            "input": payload,
        },
        ensure_ascii=False,
    )
