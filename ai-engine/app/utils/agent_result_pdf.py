from __future__ import annotations

from typing import Any

from app.utils.pdf_report import build_agent_pdf


SECTION_LABELS = {
    "dashboard_title": "Titulo del dashboard",
    "analysis_title": "Titulo del analisis",
    "title": "Titulo",
    "objective": "Objetivo",
    "audience": "Audiencia",
    "period": "Periodo",
    "data_type": "Tipo de datos",
    "analysis_type": "Tipo de analisis",
    "analysis_mode": "Modo de analisis",
    "confidence_level": "Nivel de confianza",
    "confidence_reason": "Justificacion de confianza",
    "data_understanding": "Entendimiento de datos",
    "data_profile": "Perfil y calidad de datos",
    "executive_summary": "Resumen ejecutivo",
    "generated_document": "Documento generado",
    "detected_alternatives": "Alternativas detectadas",
    "source_files": "Archivos procesados",
    "document_summaries": "Resumen de documentos procesados",
    "supporting_documents_summary": "Resumen de documentos procesados",
    "extracted_data_quality": "Calidad de extraccion",
    "data_used": "Datos usados",
    "kpis": "KPIs principales",
    "charts": "Graficos",
    "tables": "Tablas",
    "tco_matrix": "Matriz TCO comparativa",
    "tco_totals": "Totales TCO",
    "ranking": "Ranking",
    "interpretation": "Interpretacion",
    "risk_analysis": "Analisis de riesgos",
    "sensitivity_analysis": "Analisis de sensibilidad",
    "strategic_recommendation": "Recomendacion estrategica",
    "observations": "Observaciones",
    "insights": "Insights",
    "recommendations": "Recomendaciones",
    "missing_information": "Informacion faltante",
    "questions_for_user_or_suppliers": "Preguntas para usuario o proveedores",
    "questions_for_suppliers": "Preguntas para proveedores",
    "assumptions_and_limits": "Supuestos y limites",
    "suggested_filters": "Filtros sugeridos",
    "layout_suggestion": "Sugerencia de layout",
    "disclaimer": "Disclaimer",
}

SECTION_ORDER = [
    "dashboard_title",
    "analysis_title",
    "title",
    "objective",
    "audience",
    "period",
    "data_type",
    "analysis_type",
    "analysis_mode",
    "confidence_level",
    "confidence_reason",
    "data_understanding",
    "data_profile",
    "executive_summary",
    "generated_document",
    "detected_alternatives",
    "source_files",
    "document_summaries",
    "supporting_documents_summary",
    "extracted_data_quality",
    "data_used",
    "kpis",
    "charts",
    "tables",
    "tco_matrix",
    "tco_totals",
    "ranking",
    "interpretation",
    "risk_analysis",
    "sensitivity_analysis",
    "strategic_recommendation",
    "observations",
    "insights",
    "recommendations",
    "missing_information",
    "questions_for_user_or_suppliers",
    "questions_for_suppliers",
    "assumptions_and_limits",
    "suggested_filters",
    "layout_suggestion",
    "disclaimer",
]

TECHNICAL_KEYS = {
    "pdf_available",
    "llm_used",
    "model_provider",
    "model_name",
    "tokens_input",
    "tokens_output",
    "cost_input",
    "cost_output",
    "cost_total",
    "latency_ms",
}


def _is_empty(value: Any) -> bool:
    return value is None or value == "" or value == [] or value == {}


def _label(key: str) -> str:
    return SECTION_LABELS.get(key, key.replace("_", " ").capitalize())


def _chart_rows(charts: Any) -> list[dict[str, Any]]:
    rows = []
    if not isinstance(charts, list):
        return rows
    for chart in charts:
        if not isinstance(chart, dict):
            rows.append({"Grafico": chart})
            continue
        values = chart.get("data") or []
        representation = []
        if isinstance(values, list):
            for item in values:
                if isinstance(item, dict):
                    label = item.get("label") or item.get("x") or item.get("name") or "Dato"
                    value = item.get("value") or item.get("y") or item.get("amount") or "No especificado"
                    group = item.get("group")
                    representation.append(f"{label}: {value}" + (f" ({group})" if group else ""))
                else:
                    representation.append(str(item))
        rows.append(
            {
                "Grafico": chart.get("title"),
                "Tipo": chart.get("type"),
                "Fuente": chart.get("data_source") or chart.get("source"),
                "Confianza": chart.get("confidence"),
                "Datos mostrados": "; ".join(representation) or "Sin datos tabulares",
                "Insight": chart.get("insight") or chart.get("description"),
            }
        )
    return rows


def normalize_platform_result(result: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    used: set[str] = set()

    for key in SECTION_ORDER:
        if key not in result or key in TECHNICAL_KEYS or _is_empty(result.get(key)):
            continue
        value = result[key]
        normalized[_label(key)] = _chart_rows(value) if key == "charts" else value
        used.add(key)

    for key, value in result.items():
        if key in used or key in TECHNICAL_KEYS or _is_empty(value):
            continue
        normalized[_label(key)] = value

    if "charts" in result and not _is_empty(result.get("charts")):
        normalized.setdefault(
            "Nota sobre graficos",
            "Los graficos del PDF usan la misma data generada para la plataforma. Cuando no se puede dibujar el grafico exacto, se muestra una representacion tabular equivalente.",
        )

    return normalized


def infer_result_title(result: dict[str, Any], fallback: str) -> str:
    for key in ("dashboard_title", "analysis_title", "title", "document_title", "agent_name"):
        value = result.get(key)
        if value:
            return str(value)
    return fallback


def build_platform_result_pdf(
    result: dict[str, Any],
    agent_name: str,
    branding: dict[str, Any] | None = None,
    fallback_title: str | None = None,
) -> bytes:
    title = infer_result_title(result, fallback_title or agent_name)
    return build_agent_pdf(title, agent_name, normalize_platform_result(result), branding)
