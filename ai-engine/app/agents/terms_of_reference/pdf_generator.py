import re

from fastapi import HTTPException

from app.agents.terms_of_reference.schemas import TermsOfReferenceResult
from app.utils.pdf_report import build_agent_pdf


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "_", value.strip().lower()).strip("_")
    return value[:80] or "termino_referencia"


def build_pdf(document_payload: dict, branding_payload: dict | None = None) -> tuple[bytes, str]:
    try:
        result = TermsOfReferenceResult.model_validate(document_payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="El JSON del documento no tiene la estructura minima requerida.") from exc

    doc = result.generated_document
    general = doc.general_data
    budget = doc.budget_chain
    report = {
        "executive_summary": result.executive_summary,
        "datos_generales": [
            {"campo": "Nombre", "informacion": general.requirement_name},
            {"campo": "Tipo", "informacion": general.requirement_type},
            {"campo": "Categoria", "informacion": general.category},
            {"campo": "Ubicacion", "informacion": general.location or "No especificado"},
            {"campo": "Fecha requerida", "informacion": general.required_date or "No especificado"},
        ],
        "objetivo": doc.objective,
        "alcance": doc.scope,
        "caracteristicas_tecnicas": doc.technical_characteristics,
        "actividades_requeridas": doc.required_activities,
        "entregables": doc.final_deliverables,
        "justificacion": doc.justification,
        "requisitos_de_seguridad": doc.safety_requirements,
        "condiciones_para_proveedores": doc.supplier_conditions,
        "estructura_de_informe_final": doc.final_report_structure,
        "cadena_presupuestal": [
            {"campo": "Proyecto", "informacion": budget.project or "No especificado"},
            {"campo": "Centro de costos", "informacion": budget.cost_center or "No especificado"},
            {"campo": "Cuenta", "informacion": budget.account or "No especificado"},
            {"campo": "Presupuesto referencial", "informacion": budget.budget_reference or "No especificado"},
            {"campo": "Moneda", "informacion": budget.currency or "No especificado"},
        ],
        "anexos_sugeridos": doc.suggested_annexes,
        "informacion_faltante": result.missing_information,
        "recomendaciones_para_el_comprador": result.buyer_recommendations,
        "disclaimer": result.disclaimer,
    }
    return (
        build_agent_pdf(result.title, "Elaboracion de terminos de referencia", report, branding_payload),
        f"termino_referencia_{slugify(result.title)}.pdf",
    )
