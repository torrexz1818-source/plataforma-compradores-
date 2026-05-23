from __future__ import annotations

from typing import Any

from app.utils.pdf_report import build_agent_pdf


def build_tco_pdf(result: dict[str, Any], branding: dict[str, Any] | None = None) -> bytes:
    ordered: dict[str, Any] = {
        "Resumen ejecutivo": result.get("executive_summary"),
        "Datos usados": result.get("data_used"),
        "Matriz TCO comparativa": result.get("tco_matrix"),
        "Totales TCO": result.get("tco_totals"),
        "Ranking": result.get("ranking"),
        "Interpretación": result.get("interpretation"),
        "Análisis de riesgos": result.get("risk_analysis"),
        "Análisis de sensibilidad": result.get("sensitivity_analysis"),
        "Recomendación estratégica": result.get("strategic_recommendation"),
        "Preguntas o datos faltantes": {
            "missing_information": result.get("missing_information"),
            "questions_for_user_or_suppliers": result.get("questions_for_user_or_suppliers"),
        },
        "Supuestos y límites": result.get("assumptions_and_limits"),
        "Disclaimer": result.get("disclaimer"),
    }
    title = str(result.get("analysis_title") or "Análisis de Costo Total / TCO")
    return build_agent_pdf(title, "Análisis de Costo Total / TCO", ordered, branding)
