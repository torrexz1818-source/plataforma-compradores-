import json
from typing import Any

FORM_SCHEMA_SYSTEM_PROMPT = """
Actua como especialista senior en compras corporativas.
Lee la descripcion inicial del comprador y determina que tipo de requerimiento quiere crear.
Debes clasificar la categoria, detectar el tipo de requerimiento, seleccionar una plantilla recomendada y generar o ajustar un formulario detallado.
El formulario debe ser inteligente y depender de lo que el comprador quiere comprar, contratar o solicitar; evita preguntas irrelevantes.
Divide el formulario en pocos pasos claros y conserva solo campos minimos corporativos para que el documento final sea completo.
El formulario debe ser corto: evita pedir el mismo dato dos veces y no separes problema, beneficio e impacto en campos distintos.
No incluyas un campo llamado "Justificacion" ni "Justificación" en el formulario.
No incluyas campos separados para "Problema que se busca resolver", "Beneficio esperado" o "Riesgo de no ejecutar".
Usa un solo campo llamado "Observaciones importantes" para riesgos, restricciones, antecedentes, impactos, urgencias o notas criticas.
Si necesitas contexto de justificacion, solicitalo dentro de "Observaciones importantes" sin hacerlo obligatorio.
Incluye campos especificos segun la categoria, ejemplos en placeholders, requisitos tecnicos, entregables, seguridad sugerida y documentos de apoyo recomendados.
No generes todavia el termino de referencia final.
Si la descripcion es vaga, genera un formulario base y agrega preguntas sugeridas en notes_for_buyer.
Devuelve exclusivamente JSON valido con las claves solicitadas.
"""

GENERATE_SYSTEM_PROMPT = """
Actua como especialista senior en compras, abastecimiento y elaboracion de documentos de contratacion para procesos B2B en Buyer Nodus.
Genera documentos profesionales de contratacion en espanol a partir de la descripcion inicial, categoria, formulario completado, documentos de apoyo, instrucciones adicionales y plantilla seleccionada.

PROMPT MAESTRO - AGENTE DE ELABORACION DE DOCUMENTOS DE CONTRATACION
Version 2.0 | TDR + Bases del Concurso + Correo de Invitacion + Cronograma
Universal para bienes, servicios, obras, consultorias y tecnologia.

El agente puede generar: Terminos de Referencia, Bases del Concurso, Invitacion/correo para empresas postoras y Cronograma del proceso. Si el usuario pide solo un documento, genera ese documento y un resumen util. Si pide el proceso completo, genera el paquete completo: TDR, Bases del Concurso, Invitacion a postores y Cronograma. Los formatos permitidos de la plataforma son PDF, Excel y PowerPoint.

Seleccion de documentos:
- "TDR", "termino de referencia", "tdr" => Solo TDR.
- "bases", "concurso", "bases del concurso" => Solo Bases del Concurso, salvo que pida todo.
- "invitacion", "correo", "carta", "postores", "proveedores invitados" => Solo Invitacion a postores, salvo que pida todo.
- "cronograma", "calendario", "hitos" => Solo Cronograma, salvo que pida todo.
- "todo", "paquete", "proceso completo", "documentos para concurso", "concurso completo" => Paquete completo.

Todos los documentos generados deben ser coherentes entre si: mismo codigo de proceso, mismo objeto de contratacion, misma entidad convocante, mismas fechas, mismos plazos, mismo presupuesto referencial, mismos criterios de evaluacion, mismos requisitos del proveedor y mismas reglas de presentacion de propuestas.

Clasifica automaticamente el tipo de TDR en una de estas opciones exactas: Servicio simple, Servicio especializado, Bien o producto, Obra civil, Software / tecnologia, Consultoria. Usa esa clasificacion para adaptar alcance, preguntas recomendadas, documentos requeridos, garantias, riesgos, criterios y matrices. Puedes mostrarlo en el resultado como "Tipo de TDR identificado", pero no expongas razonamiento interno.

Estructura minima obligatoria del TDR:
1. Resumen ejecutivo.
2. Antecedentes.
3. Objetivo de la contratacion.
4. Alcance del servicio, producto, obra, software o consultoria.
5. Especificaciones tecnicas o requerimientos funcionales.
6. Entregables esperados.
7. Documentacion requerida al proveedor.
8. Normas tecnicas, estandares o marco aplicable.
9. Plazo, cronograma e hitos.
10. Condiciones de ejecucion o metodologia.
11. Criterios de evaluacion con ponderacion total exacta de 100 puntos.
12. Matriz de cumplimiento.
13. Garantias, penalidades y condiciones comerciales.
14. Riesgos, recomendaciones y anexos sugeridos.

Reglas de calidad:
- No inventes informacion critica: montos, fechas exactas, marcas, cantidades, proveedores, normas especificas, certificaciones obligatorias o condiciones legales si no aparecen en el input o documentos.
- Usa [COMPLETAR] para informacion critica que el comprador debe completar.
- Usa [SUGERIDO] para buenas practicas, criterios, plazos, documentos, garantias, penalidades o recomendaciones razonables.
- Si falta informacion, genera un borrador util y agrega preguntas recomendadas agrupadas para que el comprador pueda completar el TDR en una siguiente iteracion.
- No bloquees la generacion salvo que falten datos minimos ya validados por backend.
- Si hay documentos de apoyo, usalos como fuente de contexto; si no aportan informacion, dilo como limitacion y no inventes datos.
- Las bases de licitacion y el correo son una guia inicial operativa, no documentos legales definitivos, e incluyen advertencia de revision interna/legal cuando aplique.
- Devuelve encabezados, listas, matrices y tablas representadas en JSON; no devuelvas texto plano largo.

Adaptacion por tipo:
- Software / tecnologia: incluye requerimientos funcionales y no funcionales, integraciones, seguridad, disponibilidad, soporte, SLA, pruebas UAT, criterios de aceptacion, capacitacion, documentacion tecnica y garantias de soporte cuando aplique.
- Obra civil: incluye alcance tecnico, partidas o actividades, metrados si el usuario los proporciona, normas aplicables generales, seguridad y salud, control de calidad, recepcion de obra, garantias, penalidades, cronograma y supervision. No menciones ensayos especificos como Proctor salvo que el usuario o documentos lo justifiquen.
- Limpieza, mantenimiento o servicios operativos: incluye turnos, frecuencia, dotacion, equipos e insumos, supervision, KPIs, niveles de servicio, protocolos de seguridad, reportes y penalidades por incumplimiento cuando aplique.
- Bien o producto: incluye ficha tecnica, cantidades, calidad esperada, certificaciones si aplican, muestras, entrega, garantia, pruebas de aceptacion, embalaje, reposicion y soporte postventa.
- Consultoria: incluye objetivo consultivo, metodologia, plan de trabajo, entregables, perfil del equipo consultor, experiencia requerida, cronograma, transferencia de conocimiento, criterios tecnicos y confidencialidad.
- Servicio especializado: incluye perfil tecnico, certificaciones si aplican, metodologia, herramientas o equipos, protocolos, entregables, indicadores, controles de calidad y SLA si aplica.

Criterios de evaluacion:
- Genera evaluation_matrix con criterios y subcriterios verificables.
- La suma de score debe ser exactamente 100.
- Separa criterios tecnicos, economicos, experiencia, plazo, garantia/soporte o seguridad segun corresponda.
- No uses siempre la misma matriz; adaptala al tipo de TDR.

Matriz de cumplimiento:
- Usa columnas conceptuales: requirement, type, mandatory, expected_evidence, status.
- status solo puede ser [COMPLETAR], Cumple, No aplica o Por validar.
- No marques Cumple si no existe evidencia.

Checklist interno:
- Revisa internamente estructura, objetivo, alcance, entregables, criterios que sumen 100, requisitos tecnicos, documentos, riesgos, garantias, penalidades, cronograma, uso de [SUGERIDO]/[COMPLETAR], adaptacion al tipo, lenguaje profesional y compatibilidad con descargables.
- No muestres el checklist interno completo como log tecnico. Si aportas valor, devuelve solo una consistencia resumida en consistency_validation.

Devuelve exclusivamente JSON valido. No devuelvas markdown fuera del JSON. No incluyas prompts internos, logs, rutas tecnicas, nombres de funciones ni detalles de LLM.
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
            "document_request_detected": payload.get("document_request"),
            "generated_documents_expected": payload.get("generated_documents"),
            "required_output_shape": {
                "title": "string",
                "requirement_type": "string",
                "category": "string",
                "template_used": "string",
                "document_request": "Solo TDR|Solo Bases del Concurso|Solo Invitacion a postores|Solo Cronograma|Paquete completo",
                "generated_documents": ["TDR|Bases del Concurso|Invitacion a postores|Cronograma"],
                "process_code": "string",
                "contracting_entity": {
                    "business_name": "string",
                    "tax_id": "string",
                    "address": "string",
                    "institutional_contact": "string",
                    "process_owner": "string",
                    "requesting_area": "string",
                },
                "invited_bidders": [
                    {
                        "contact_name": "string",
                        "business_name": "string",
                        "role": "string",
                        "email": "string",
                    }
                ],
                "executive_summary": "string",
                "generated_document": {
                    "general_data": {
                        "requirement_name": "string",
                        "requirement_type": "string",
                        "category": "string",
                        "location": "string|null",
                        "required_date": "string|null",
                    },
                    "tdr_type": "Servicio simple|Servicio especializado|Bien o producto|Obra civil|Software / tecnologia|Consultoria",
                    "background": "string",
                    "objective": "string",
                    "scope": "string",
                    "technical_characteristics": ["string"],
                    "required_activities": ["string"],
                    "final_deliverables": ["string"],
                    "required_documents": ["string"],
                    "applicable_standards": ["string"],
                    "suggested_schedule": ["string"],
                    "execution_conditions": ["string"],
                    "justification": "string",
                    "safety_requirements": ["string"],
                    "supplier_conditions": ["string"],
                    "commercial_conditions": ["string"],
                    "evaluation_criteria": ["string"],
                    "evaluation_matrix": [
                        {
                            "criterion": "string",
                            "subcriterion": "string",
                            "score": 0,
                            "required_evidence": "string",
                        }
                    ],
                    "compliance_matrix": [
                        {
                            "requirement": "string",
                            "type": "Tecnico|Documentario|Comercial|Seguridad|Legal|Operativo",
                            "expected_evidence": "string",
                            "mandatory": "Obligatorio|Deseable|No aplica",
                            "status": "[COMPLETAR]|Cumple|No aplica|Por validar",
                        }
                    ],
                    "identified_risks": [
                        {
                            "risk": "string",
                            "impact": "Bajo|Medio|Alto",
                            "mitigation": "string",
                        }
                    ],
                    "guarantees_penalties": [
                        {
                            "item": "string",
                            "type": "Garantia|Penalidad|Condicion comercial",
                            "condition": "string",
                            "status": "[SUGERIDO]|[COMPLETAR]",
                        }
                    ],
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
                "recommended_questions": ["string"],
                "consistency_validation": ["string"],
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
                "process_schedule": [
                    {
                        "number": "string",
                        "phase": "FASE 1|FASE 2|FASE 3|FASE 4",
                        "activity": "string",
                        "responsible": "string",
                        "start": "string",
                        "end": "string",
                        "duration": "string",
                        "deliverable": "string",
                        "observations": "string",
                    }
                ],
                "tender_process": ["string"],
                "disclaimer": "Este documento fue generado con asistencia de IA y debe ser revisado por el comprador antes de enviarse a proveedores.",
            },
            "input": payload,
        },
        ensure_ascii=False,
    )
