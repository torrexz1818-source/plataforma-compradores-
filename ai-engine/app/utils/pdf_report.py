from __future__ import annotations

from datetime import datetime
from io import BytesIO
from typing import Any

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


def _flatten_value(value: Any) -> str:
    if isinstance(value, dict):
        return ", ".join(f"{key}: {_flatten_value(item)}" for key, item in value.items())
    if isinstance(value, list):
        return "; ".join(_flatten_value(item) for item in value)
    return str(value)


def build_agent_pdf(title: str, agent_name: str, result: dict[str, Any]) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, title=title)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("Buyer Nodus", styles["Title"]),
        Paragraph(agent_name, styles["Heading2"]),
        Paragraph(datetime.utcnow().strftime("Generado el %Y-%m-%d %H:%M UTC"), styles["Normal"]),
        Spacer(1, 14),
    ]

    for key, value in result.items():
        story.append(Paragraph(str(key).replace("_", " ").title(), styles["Heading3"]))
        story.append(Paragraph(_flatten_value(value), styles["BodyText"]))
        story.append(Spacer(1, 8))

    story.append(Spacer(1, 12))
    story.append(
        Paragraph(
            "Documento generado por Nodus IA como apoyo a decisiones de compra. Validar datos críticos antes de tomar decisiones finales.",
            styles["Italic"],
        )
    )
    doc.build(story)
    return buffer.getvalue()
