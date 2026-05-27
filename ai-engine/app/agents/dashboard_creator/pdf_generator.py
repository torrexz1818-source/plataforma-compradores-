from __future__ import annotations

from typing import Any

from app.utils.agent_result_pdf import build_platform_result_pdf

TECHNICAL_KEYS = {
    "dataProfile",
    "dashboardPlan",
    "data_profile",
    "metadata",
    "data_understanding",
    "visualConfig",
    "layout_suggestion",
    "suggested_filters",
    "document_summaries",
    "qualityWarnings",
    "observations",
    "missingData",
    "missing_information",
    "source_files",
    "objective",
    "analysis_mode",
    "data_understanding",
    "visualConfig",
    "suggested_filters",
    "layout_suggestion",
    "disclaimer",
}

DASHBOARD_CREATOR_DISCLAIMER = (
    "Este dashboard de compras fue generado con asistencia de IA a partir de los archivos cargados por el usuario. "
    "La información, indicadores y recomendaciones deben ser revisados y validados por el comprador antes de tomar decisiones finales."
)


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
    cleaned["tables"] = [
        item for item in result.get("tables", [])
        if isinstance(item, dict)
        and not any(token in str(item.get("title", "")).lower() for token in ("documentos procesados", "archivos procesados", "calidad", "data profile", "datos faltantes"))
    ][:4]
    cleaned["charts"] = [item for item in result.get("charts", []) if isinstance(item, dict) and item.get("data")][:8]
    cleaned["findings"] = [item for item in result.get("findings", []) if isinstance(item, dict) and item.get("title") and item.get("description")][:8]
    cleaned["recommendations"] = [item for item in result.get("recommendations", []) if item][:8]
    cleaned["disclaimer"] = DASHBOARD_CREATOR_DISCLAIMER
    return cleaned


def build_dashboard_pdf(result: dict[str, Any], branding: dict[str, Any] | None = None) -> bytes:
    """Legacy-compatible PDF path.

    The frontend export flow uses src/lib/agentPdf.ts as the official path.
    This backend endpoint only converts the provided DashboardResult and must
    not recalculate metrics or call the LLM.
    """
    return build_platform_result_pdf(_executive_result(result), "Creador de Dashboard", branding, "Creador de Dashboard")
