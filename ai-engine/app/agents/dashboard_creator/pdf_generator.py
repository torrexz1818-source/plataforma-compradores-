from __future__ import annotations

from typing import Any

from app.utils.pdf_report import build_agent_pdf


def build_dashboard_pdf(result: dict[str, Any], branding: dict[str, Any] | None = None) -> bytes:
    ordered = {
        "Resumen ejecutivo": result.get("executive_summary"),
        "KPIs principales": result.get("kpis"),
        "Gráficos": result.get("charts"),
        "Tablas principales": result.get("tables"),
        "Insights": result.get("insights"),
        "Recomendaciones": result.get("recommendations"),
        "Calidad de datos": result.get("data_profile", {}).get("data_quality_warnings"),
        "Información faltante": result.get("missing_information"),
        "Filtros sugeridos": result.get("suggested_filters"),
        "Disclaimer": result.get("disclaimer"),
    }
    title = str(result.get("dashboard_title") or "Creador de Dashboard")
    return build_agent_pdf(title, "Creador de Dashboard", ordered, branding)
