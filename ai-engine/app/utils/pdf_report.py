from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Literal

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

PdfMode = Literal["standard_branded", "white_label", "custom_brand"]
TEMPLATE_PATH = Path(__file__).resolve().parents[1] / "assets" / "pdf" / "buyer_nodus_report_template.pdf"


@dataclass
class PdfBranding:
    mode: PdfMode = "standard_branded"
    company_name: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None
    footer_text: str | None = None
    user_name: str | None = None


def normalize_pdf_mode(value: str | None) -> PdfMode:
    if value in {"white_label", "custom_brand"}:
        return value
    return "standard_branded"


def build_branding(payload: dict[str, Any] | None = None) -> PdfBranding:
    payload = payload or {}
    return PdfBranding(
        mode=normalize_pdf_mode(payload.get("pdf_mode") or payload.get("mode")),
        company_name=payload.get("company_name") or payload.get("custom_brand_name"),
        logo_url=payload.get("logo_url") or payload.get("custom_logo_url"),
        primary_color=payload.get("primary_color") or payload.get("custom_primary_color"),
        footer_text=payload.get("footer_text") or payload.get("custom_footer_text"),
        user_name=payload.get("user_name"),
    )


def _clean_text(value: Any) -> str:
    text = "" if value is None else str(value)
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "<br/>")
    )


def _flatten_value(value: Any) -> str:
    if value is None:
        return "No especificado."
    if isinstance(value, dict):
        lines = []
        for key, item in value.items():
            label = str(key).replace("_", " ").title()
            if isinstance(item, (dict, list)):
                lines.append(f"<b>{_clean_text(label)}:</b><br/>{_flatten_value(item)}")
            else:
                lines.append(f"<b>{_clean_text(label)}:</b> {_clean_text(item)}")
        return "<br/>".join(lines) or "Sin datos."
    if isinstance(value, list):
        if not value:
            return "Sin datos."
        return "<br/>".join(f"- {_flatten_value(item)}" if not isinstance(item, dict) else _flatten_value(item) for item in value)
    return _clean_text(value)


def _build_table_from_list(items: list[Any]) -> Table | None:
    dict_items = [item for item in items if isinstance(item, dict)]
    if not dict_items:
        return None

    keys = list(dict_items[0].keys())[:5]
    if not keys:
        return None

    data = [[str(key).replace("_", " ").title() for key in keys]]
    for item in dict_items[:18]:
        data.append([_clean_text(item.get(key, "No especificado"))[:180] for key in keys])

    table = Table(data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2ff")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7.4),
                ("LEADING", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#dbe3f0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ]
        )
    )
    return table


def _footer_text(branding: PdfBranding) -> str:
    if branding.mode == "standard_branded":
        return "Generado por Buyer Nodus - Nodus IA"
    if branding.mode == "custom_brand":
        return branding.footer_text or f"Generado para {branding.company_name or 'la empresa compradora'}"
    return branding.footer_text or "Documento generado por asistente de inteligencia artificial"


def _draw_footer(canvas, doc, branding: PdfBranding) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawString(doc.leftMargin, 1.05 * cm, _footer_text(branding))
    canvas.drawRightString(A4[0] - doc.rightMargin, 1.05 * cm, f"Pagina {doc.page}")
    canvas.restoreState()


def _split_cover_title(value: str, max_chars: int = 34) -> list[str]:
    words = value.replace("\n", " ").split()
    lines: list[str] = []
    current = ""

    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word

    if current:
        lines.append(current)

    return lines or ["Reporte Nodus IA"]


def _build_template_overlay(title: str, agent_name: str, branding: PdfBranding) -> bytes:
    from reportlab.pdfgen import canvas

    buffer = BytesIO()
    page_width, page_height = A4
    cover = canvas.Canvas(buffer, pagesize=A4)
    primary = colors.HexColor(branding.primary_color or "#09008B")

    # The uploaded template contains the placeholder "TITULO DEL TRABAJO" in this zone.
    cover.setFillColor(colors.white)
    cover.rect(52, page_height - 122, page_width - 104, 84, fill=1, stroke=0)

    cover.setFillColor(primary)
    cover.setFont("Helvetica-Bold", 23)
    text = cover.beginText()
    text.setTextOrigin(72, page_height - 66)
    text.setLeading(27)
    for line in _split_cover_title(title)[:2]:
        text.textLine(line)
    cover.drawText(text)

    cover.setFillColor(colors.HexColor("#4b5563"))
    cover.setFont("Helvetica", 10)
    cover.drawString(72, page_height - 130, agent_name)
    cover.drawString(72, page_height - 146, datetime.utcnow().strftime("Generado el %Y-%m-%d %H:%M UTC"))
    if branding.user_name or branding.company_name:
        cover.drawString(72, page_height - 162, f"Preparado para: {branding.user_name or branding.company_name}")

    cover.save()
    return buffer.getvalue()


def _prepend_template_cover(content_pdf: bytes, title: str, agent_name: str, branding: PdfBranding) -> bytes:
    if branding.mode != "standard_branded" or not TEMPLATE_PATH.exists():
        return content_pdf

    try:
        from pypdf import PdfReader, PdfWriter

        template_reader = PdfReader(str(TEMPLATE_PATH))
        overlay_reader = PdfReader(BytesIO(_build_template_overlay(title, agent_name, branding)))
        content_reader = PdfReader(BytesIO(content_pdf))

        writer = PdfWriter()
        cover_page = template_reader.pages[0]
        cover_page.merge_page(overlay_reader.pages[0])
        writer.add_page(cover_page)

        for page in content_reader.pages:
            writer.add_page(page)

        output = BytesIO()
        writer.write(output)
        return output.getvalue()
    except Exception:
        return content_pdf


def build_agent_pdf(
    title: str,
    agent_name: str,
    result: dict[str, Any],
    branding: PdfBranding | dict[str, Any] | None = None,
) -> bytes:
    brand = build_branding(branding) if isinstance(branding, dict) or branding is None else branding
    primary = colors.HexColor(brand.primary_color or "#1d4ed8")
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        title=title,
        rightMargin=1.55 * cm,
        leftMargin=1.55 * cm,
        topMargin=1.45 * cm,
        bottomMargin=1.7 * cm,
    )
    base = getSampleStyleSheet()
    styles = {
        "Brand": ParagraphStyle("Brand", parent=base["BodyText"], fontSize=9, leading=12, textColor=primary),
        "Title": ParagraphStyle("Title", parent=base["Title"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=colors.HexColor("#0f172a")),
        "Meta": ParagraphStyle("Meta", parent=base["BodyText"], fontSize=8.5, leading=12, textColor=colors.HexColor("#64748b")),
        "Section": ParagraphStyle("Section", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=primary, spaceBefore=9),
        "Body": ParagraphStyle("Body", parent=base["BodyText"], fontSize=9.2, leading=13.5, textColor=colors.HexColor("#111827")),
        "Disclaimer": ParagraphStyle("Disclaimer", parent=base["Italic"], fontSize=8.2, leading=11.5, textColor=colors.HexColor("#64748b")),
        "Cover": ParagraphStyle("Cover", parent=base["Title"], fontSize=22, leading=27, alignment=TA_CENTER, textColor=colors.HexColor("#0f172a")),
    }

    brand_label = ""
    if brand.mode == "standard_branded":
        brand_label = "Buyer Nodus - Nodus IA"
    elif brand.mode == "custom_brand":
        brand_label = brand.company_name or "Documento corporativo"

    story: list[Any] = []
    display_title = (
        title.replace(".pdf", "").replace("-", " ").title()
        if title.lower().endswith(".pdf") or "-" in title
        else title
    )
    if brand_label:
        story.append(Paragraph(_clean_text(brand_label), styles["Brand"]))
    story.append(Paragraph(_clean_text(display_title), styles["Title"]))
    story.append(Paragraph(_clean_text(agent_name), styles["Meta"]))
    story.append(Paragraph(datetime.utcnow().strftime("Fecha de generacion: %Y-%m-%d %H:%M UTC"), styles["Meta"]))
    if brand.user_name or brand.company_name:
        story.append(Paragraph(_clean_text(f"Preparado para: {brand.user_name or brand.company_name}"), styles["Meta"]))
    story.append(Spacer(1, 0.35 * cm))

    summary = result.get("executive_summary") or result.get("summary") or result.get("final_recommendation")
    if summary:
        story.append(Paragraph("Resumen ejecutivo", styles["Section"]))
        story.append(Paragraph(_flatten_value(summary), styles["Body"]))
        story.append(Spacer(1, 0.2 * cm))

    for key, value in result.items():
        if key in {"executive_summary", "summary"}:
            continue
        title_label = str(key).replace("_", " ").title()
        story.append(Paragraph(_clean_text(title_label), styles["Section"]))
        if isinstance(value, list):
            table = _build_table_from_list(value)
            if table is not None:
                story.append(table)
            else:
                story.append(Paragraph(_flatten_value(value), styles["Body"]))
        else:
            story.append(Paragraph(_flatten_value(value), styles["Body"]))
        story.append(Spacer(1, 0.22 * cm))

    story.append(Spacer(1, 0.2 * cm))
    story.append(
        Paragraph(
            "Documento generado por Nodus IA como apoyo a decisiones de compra. Validar datos criticos, condiciones comerciales y supuestos antes de tomar decisiones finales.",
            styles["Disclaimer"],
        )
    )
    doc.build(story, onFirstPage=lambda canvas, doc_: _draw_footer(canvas, doc_, brand), onLaterPages=lambda canvas, doc_: _draw_footer(canvas, doc_, brand))
    return _prepend_template_cover(buffer.getvalue(), display_title, agent_name, brand)
