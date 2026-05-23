from datetime import datetime
from io import BytesIO
import re

from fastapi import HTTPException
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from app.agents.terms_of_reference.schemas import TermsOfReferenceResult
from app.utils.pdf_report import build_branding


def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "_", value.strip().lower()).strip("_")
    return value[:80] or "termino_referencia"


def _list_items(items: list[str]) -> str:
    if not items:
        return "No especificado."
    return "<br/>".join(f"- {item}" for item in items)


def _add_section(story: list, styles: dict, title: str, content: str) -> None:
    story.append(Paragraph(title, styles["Section"]))
    story.append(Paragraph(content or "No especificado.", styles["Body"]))
    story.append(Spacer(1, 0.25 * cm))


def build_pdf(document_payload: dict, branding_payload: dict | None = None) -> tuple[bytes, str]:
    try:
        result = TermsOfReferenceResult.model_validate(document_payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="El JSON del documento no tiene la estructura minima requerida.") from exc

    buffer = BytesIO()
    pdf = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.7 * cm,
        leftMargin=1.7 * cm,
        topMargin=1.6 * cm,
        bottomMargin=1.5 * cm,
        title=result.title,
    )
    base = getSampleStyleSheet()
    styles = {
        "Title": ParagraphStyle("Title", parent=base["Title"], fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=colors.HexColor("#1f2937")),
        "Meta": ParagraphStyle("Meta", parent=base["BodyText"], fontSize=8.5, leading=12, textColor=colors.HexColor("#4b5563")),
        "Section": ParagraphStyle("Section", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=11, leading=15, spaceBefore=8, textColor=colors.HexColor("#1d4ed8")),
        "Body": ParagraphStyle("Body", parent=base["BodyText"], fontSize=9.5, leading=14, textColor=colors.HexColor("#111827")),
    }

    doc = result.generated_document
    general = doc.general_data
    budget = doc.budget_chain
    branding = build_branding(branding_payload)
    brand_label = ""
    if branding.mode == "standard_branded":
        brand_label = "Buyer Nodus - Nodus IA"
    elif branding.mode == "custom_brand":
        brand_label = branding.company_name or "Documento corporativo"

    story: list = [
        *( [Paragraph(brand_label, styles["Meta"])] if brand_label else [] ),
        Paragraph(result.title, styles["Title"]),
        Paragraph(f"Fecha de generacion: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles["Meta"]),
        Paragraph(f"Tipo: {result.requirement_type} | Categoria: {result.category}", styles["Meta"]),
        Spacer(1, 0.35 * cm),
    ]

    _add_section(story, styles, "Resumen del requerimiento", result.executive_summary)
    _add_section(
        story,
        styles,
        "Datos generales",
        f"Nombre: {general.requirement_name}<br/>Tipo: {general.requirement_type}<br/>Categoria: {general.category}<br/>Ubicacion: {general.location or 'No especificado'}<br/>Fecha requerida: {general.required_date or 'No especificado'}",
    )
    _add_section(story, styles, "Objetivo", doc.objective)
    _add_section(story, styles, "Alcance", doc.scope)
    _add_section(story, styles, "Caracteristicas tecnicas", _list_items(doc.technical_characteristics))
    _add_section(story, styles, "Actividades requeridas", _list_items(doc.required_activities))
    _add_section(story, styles, "Producto final / entregables", _list_items(doc.final_deliverables))
    _add_section(story, styles, "Justificacion", doc.justification)
    _add_section(story, styles, "Requisitos de seguridad / SST / SSMA", _list_items(doc.safety_requirements))
    _add_section(story, styles, "Condiciones para proveedores", _list_items(doc.supplier_conditions))
    _add_section(story, styles, "Estructura de informe final", _list_items(doc.final_report_structure))
    _add_section(
        story,
        styles,
        "Cadena presupuestal",
        f"Proyecto: {budget.project or 'No especificado'}<br/>Centro de costos: {budget.cost_center or 'No especificado'}<br/>Cuenta: {budget.account or 'No especificado'}<br/>Presupuesto referencial: {budget.budget_reference or 'No especificado'}<br/>Moneda: {budget.currency or 'No especificado'}",
    )
    _add_section(story, styles, "Anexos sugeridos", _list_items(doc.suggested_annexes))
    _add_section(story, styles, "Informacion faltante o puntos por validar", _list_items(result.missing_information))
    _add_section(story, styles, "Recomendaciones para el comprador", _list_items(result.buyer_recommendations))
    _add_section(story, styles, "Disclaimer", result.disclaimer)

    pdf.build(story)
    return buffer.getvalue(), f"termino_referencia_{slugify(result.title)}.pdf"
