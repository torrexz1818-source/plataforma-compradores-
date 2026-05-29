from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

BUYER_NODUS_VISUAL_CONFIG = {
    "background": "white",
    "primary": "#0E109E",
    "secondary": "#5A31D5",
    "danger": "#F3313F",
    "success": "#B2EB4A",
}


def _summary_block(executive_summary: str, profiled: dict[str, Any], missing_information: list[str]) -> dict[str, Any]:
    kpis = [str(item.get("title")) for item in profiled.get("kpis", []) if isinstance(item, dict) and item.get("title")]
    document_traceability = [
        item.get("traceability")
        for item in profiled.get("document_summaries", [])
        if isinstance(item, dict) and item.get("traceability")
    ]
    sample_warnings = [
        warning
        for warning in profile.get("data_quality_warnings", [])
        if "muestra" in str(warning).lower() or "sample" in str(warning).lower()
    ]
    readiness_status = "ready"
    readiness_reason = "Dashboard construido con indicadores y visualizaciones disponibles."
    if not profiled.get("kpis") or not (charts or tables):
        readiness_status = "blocked"
        readiness_reason = "Se requieren KPIs, graficos o tablas con datos suficientes para descargar un dashboard util."
    elif sample_warnings:
        readiness_status = "ready_with_validation"
        readiness_reason = "El dashboard usa muestras o lectura parcial; validar advertencias antes de decidir."

    return {
        "information_found": executive_summary,
        "analysis_built": "Reporte ejecutivo generado a partir de los archivos cargados, con indicadores calculados segun la informacion disponible.",
        "main_indicators": kpis[:8],
        "limitations": missing_information[:10],
    }


def _with_required_chart_fields(charts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    prepared = []
    colors = ["#0E109E", "#5A31D5", "#F3313F", "#B2EB4A", "#2F80ED", "#22A06B", "#F59E0B", "#64748B"]
    for chart in charts:
        if not isinstance(chart, dict) or not chart.get("data"):
            continue
        data = chart.get("data") if isinstance(chart.get("data"), list) else []
        if not chart.get("legend"):
            chart["legend"] = [
                {"label": str(point.get("label") or "Sin etiqueta"), "value": str(point.get("value") or 0), "color": colors[index % len(colors)]}
                for index, point in enumerate(data[:12])
                if isinstance(point, dict)
            ]
        chart["colors"] = chart.get("colors") or colors[: max(1, min(len(data), len(colors)))]
        prepared.append(chart)
    return prepared


def _non_empty_tables(tables: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [table for table in tables if isinstance(table, dict) and table.get("columns") and table.get("rows")]


def _evidence_findings(profiled: dict[str, Any], findings: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    prepared = [
        item for item in list(findings or [])
        if isinstance(item, dict)
        and item.get("title")
        and item.get("description")
        and str(item.get("description")).strip().lower() not in {"chart", "kpi", "table"}
    ]
    if prepared:
        return prepared[:12]
    for kpi in profiled.get("kpis", [])[:4]:
        if not isinstance(kpi, dict):
            continue
        prepared.append(
            {
                "title": str(kpi.get("title") or "KPI calculado"),
                "description": str(kpi.get("description") or f"Valor calculado: {kpi.get('value')}"),
                "evidence": f"{kpi.get('title')}: {kpi.get('value')}",
                "source_component": "kpi",
                "confidence": kpi.get("confidence", "medium"),
                "inferred": False,
            }
        )
    for chart in profiled.get("charts", [])[:2]:
        if not isinstance(chart, dict) or not chart.get("data"):
            continue
        prepared.append(
            {
                "title": str(chart.get("title") or "Grafico calculado"),
                "description": str(chart.get("insight") or chart.get("description") or "Visualizacion construida con informacion disponible para priorizar decisiones de compra."),
                "evidence": f"{len(chart.get('data', []))} segmentos analizados",
                "source_component": "chart",
                "confidence": chart.get("confidence", "medium"),
                "inferred": False,
            }
        )
    return prepared[:12]


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
    dashboard_plan: dict[str, Any] | None = None,
    findings: list[dict[str, Any]] | None = None,
    missing_data_items: list[dict[str, Any]] | None = None,
    llm_used: bool = False,
    model_provider: str | None = None,
    model_name: str | None = None,
    latency_ms: int = 0,
) -> dict[str, Any]:
    profile = profiled["profile"]
    confidence_reason = profiled.get("confidence_reason")
    charts = _with_required_chart_fields(profiled.get("charts", []))
    tables = _non_empty_tables(profiled.get("tables", []))
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

    source_files = profiled.get("source_files", [])
    plan_report_info = dashboard_plan.get("reportInfo", {}) if dashboard_plan else {}
    dashboard_title = profiled.get("suggested_title") or plan_report_info.get("dashboardTitle") or title
    return {
        "metadata": {
            "title": dashboard_title,
            "report_name": (dashboard_plan.get("report_name") if dashboard_plan else None) or plan_report_info.get("reportName") or dashboard_title,
            "created_from": "Buyer Nodus",
            "agent_name": "Creador de Dashboard",
            "agent_key": "dashboard_creator",
            "user": None,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "analyzed_files": source_files,
        },
        "dashboard_title": dashboard_title,
        "objective": objective,
        "audience": audience,
        "period": period,
        "data_type": data_type,
        "analysis_mode": profiled.get("analysis_mode", "structured_data"),
        "confidence_level": profiled.get("confidence_level", "medium"),
        "confidence_reason": confidence_reason,
        "executive_summary": executive_summary,
        "executiveSummary": _summary_block(executive_summary, profiled, missing_information),
        "llm_used": llm_used,
        "data_understanding": profiled.get("data_understanding", {}),
        "data_profile": profile,
        "dataProfile": profile,
        "dashboardPlan": dashboard_plan,
        "document_traceability": document_traceability,
        "kpis": profiled.get("kpis", []),
        "charts": charts,
        "tables": tables,
        "insights": insights,
        "observations": observations,
        "recommendations": recommendations,
        "missing_information": missing_information,
        "findings": _evidence_findings(profiled, findings),
        "missingData": missing_data_items or [],
        "qualityWarnings": profile.get("data_quality_warnings", []),
        "document_summaries": profiled.get("document_summaries", []),
        "source_files": source_files,
        "suggested_filters": profiled.get("suggested_filters", []),
        "layout_suggestion": layout,
        "visualConfig": BUYER_NODUS_VISUAL_CONFIG,
        "pdf_available": True,
        "downloadReadiness": {
            "status": readiness_status,
            "reason": readiness_reason,
        },
        "model_provider": model_provider,
        "model_name": model_name,
        "latency_ms": latency_ms,
        "disclaimer": "Este dashboard fue generado con asistencia de IA y análisis automatizado. Debe ser validado por el comprador antes de tomar decisiones.",
    }
