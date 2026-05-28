from app.agents.terms_of_reference.schemas import TermsOfReferenceResult

REQUIRED_DOCUMENT_LISTS = {
    "technical_characteristics": "Caracteristicas tecnicas",
    "required_activities": "Actividades requeridas",
    "final_deliverables": "Producto final / entregables",
    "required_documents": "Documentacion requerida al proveedor",
    "evaluation_matrix": "Criterios de evaluacion ponderados",
    "compliance_matrix": "Matriz de cumplimiento",
    "safety_requirements": "Requisitos de seguridad",
    "supplier_conditions": "Condiciones para proveedores",
    "guarantees_penalties": "Garantias, penalidades y condiciones comerciales",
}


def validate_quality(result: TermsOfReferenceResult) -> TermsOfReferenceResult:
    warnings = list(result.quality_check.warnings)
    missing_sections = list(result.quality_check.missing_sections)
    document = result.generated_document

    scalar_checks = [
        (document.objective, "Objetivo"),
        (document.scope, "Alcance"),
        (document.justification, "Justificacion"),
    ]
    for value, label in scalar_checks:
        if not value.strip() and label not in missing_sections:
            missing_sections.append(label)

    for attr, label in REQUIRED_DOCUMENT_LISTS.items():
        if not getattr(document, attr) and label not in missing_sections:
            missing_sections.append(label)

    if not result.missing_information:
        result.missing_information.append("Validar si existen datos adicionales de cantidades, metrajes, fechas, responsables internos o restricciones operativas.")

    if not result.buyer_recommendations:
        result.buyer_recommendations.append("Revisar el documento con el usuario interno y el area de SST/SSMA antes de enviarlo a proveedores.")

    score_total = sum(int(item.get("score") or 0) for item in document.evaluation_matrix)
    if document.evaluation_matrix and score_total != 100:
        warnings.append("La matriz de evaluacion fue ajustada para sumar 100 puntos.")

    if missing_sections:
        warnings.append("El documento requiere validar o completar secciones minimas antes de su uso final.")
        result.buyer_recommendations.append(
            "Completar o validar las secciones faltantes identificadas por el control de calidad."
        )

    result.quality_check.missing_sections = sorted(set(missing_sections))
    result.quality_check.warnings = sorted(set(warnings))
    result.quality_check.is_complete = not result.quality_check.missing_sections
    return result
