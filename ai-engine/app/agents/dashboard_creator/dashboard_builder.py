from __future__ import annotations

from typing import Any


def build_dashboard_result(
    *,
    title: str,
    objective: str,
    audience: str | None,
    period: str | None,
    data_type: str | None,
    profiled: dict[str, Any],
    executive_summary: str,
    insights: list[dict[str, Any]],
    observations: list[dict[str, Any]],
    recommendations: list[str],
    missing_information: list[str],
    llm_used: bool,
    model_provider: str | None,
    model_name: str | None,
    latency_ms: int,
) -> dict[str, Any]:
    profile = profiled["profile"]
    confidence_reason = profiled.get("confidence_reason")
    layout = [
        {"section": "Resumen ejecutivo", "component_type": "insight", "title": "Resumen ejecutivo", "priority": 1},
        {"section": "KPIs", "component_type": "kpi", "title": "KPIs principales", "priority": 2},
        {"section": "Gráficos", "component_type": "chart", "title": "Visualizaciones", "priority": 3},
        {"section": "Tablas", "component_type": "table", "title": "Tablas resumen", "priority": 4},
    ]
    if observations:
        layout.append({"section": "Observaciones", "component_type": "alert", "title": "Observaciones", "priority": 5})
    if profile["data_quality_warnings"]:
        layout.append({"section": "Calidad de datos", "component_type": "alert", "title": "Advertencias", "priority": 6})

    return {
        "dashboard_title": profiled.get("suggested_title") or title,
        "objective": objective,
        "audience": audience,
        "period": period,
        "data_type": data_type,
        "analysis_mode": profiled.get("analysis_mode", "structured_data"),
        "confidence_level": profiled.get("confidence_level", "medium"),
        "confidence_reason": confidence_reason,
        "executive_summary": executive_summary,
        "llm_used": llm_used,
        "data_understanding": profiled.get("data_understanding", {}),
        "data_profile": profile,
        "kpis": profiled.get("kpis", []),
        "charts": profiled.get("charts", []),
        "tables": profiled.get("tables", []),
        "insights": insights,
        "observations": observations,
        "recommendations": recommendations,
        "missing_information": missing_information,
        "document_summaries": profiled.get("document_summaries", []),
        "source_files": profiled.get("source_files", []),
        "suggested_filters": profiled.get("suggested_filters", []),
        "layout_suggestion": layout,
        "pdf_available": True,
        "model_provider": model_provider,
        "model_name": model_name,
        "latency_ms": latency_ms,
        "disclaimer": "Este dashboard fue generado con asistencia de IA y análisis automatizado. Debe ser validado por el comprador antes de tomar decisiones.",
    }
