from __future__ import annotations

from typing import Any

from app.utils.agent_result_pdf import build_platform_result_pdf

TECHNICAL_KEYS = {
    "dataProfile",
    "dashboardPlan",
    "data_profile",
    "data_understanding",
    "visualConfig",
    "layout_suggestion",
    "suggested_filters",
    "document_summaries",
    "qualityWarnings",
}


def _executive_result(result: dict[str, Any]) -> dict[str, Any]:
    cleaned = {key: value for key, value in result.items() if key not in TECHNICAL_KEYS}
    summary = cleaned.get("executiveSummary")
    if isinstance(summary, dict):
        summary = dict(summary)
        summary["analysis_built"] = "Reporte ejecutivo generado a partir de los archivos cargados, con indicadores calculados segun la informacion disponible."
        cleaned["executiveSummary"] = summary
    cleaned["kpis"] = [
        {key: value for key, value in item.items() if key not in {"source", "calculation_logic"}}
        for item in result.get("kpis", [])
        if isinstance(item, dict) and item.get("title") not in {"Registros analizados", "Columnas detectadas"}
    ]
    return cleaned


def build_dashboard_pdf(result: dict[str, Any], branding: dict[str, Any] | None = None) -> bytes:
    """Legacy-compatible PDF path.

    The frontend export flow uses src/lib/agentPdf.ts as the official path.
    This backend endpoint only converts the provided DashboardResult and must
    not recalculate metrics or call the LLM.
    """
    return build_platform_result_pdf(_executive_result(result), "Creador de Dashboard", branding, "Creador de Dashboard")
