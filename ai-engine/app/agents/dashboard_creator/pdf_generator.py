from __future__ import annotations

from typing import Any

from app.utils.pdf_report import build_agent_pdf


def _chart_rows(charts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for chart in charts or []:
        values = chart.get("data") or []
        rows.append(
            {
                "Grafico": chart.get("title"),
                "Tipo": chart.get("type"),
                "Fuente": chart.get("data_source"),
                "Confianza": chart.get("confidence"),
                "Representacion": "; ".join(
                    f"{item.get('label')}: {item.get('value')}" for item in values[:8] if isinstance(item, dict)
                ),
                "Insight": chart.get("insight"),
            }
        )
    return rows


def build_dashboard_pdf(result: dict[str, Any], branding: dict[str, Any] | None = None) -> bytes:
    understanding = result.get("data_understanding") or {}
    ordered = {
        "Resumen ejecutivo": result.get("executive_summary"),
        "Tipo de analisis": {
            "Modo": result.get("analysis_mode"),
            "Confianza": result.get("confidence_level"),
            "Analisis detectado": understanding.get("detected_analysis_type"),
            "Nivel de estructura": understanding.get("structure_level"),
            "Notas": understanding.get("notes"),
        },
        "KPIs principales": result.get("kpis"),
        "Graficos": _chart_rows(result.get("charts") or []),
        "Nota sobre graficos": "Representacion tabular del grafico generado en plataforma.",
        "Tablas principales": result.get("tables"),
        "Archivos procesados": result.get("source_files"),
        "Documentos de soporte": result.get("document_summaries"),
        "Observaciones": result.get("observations"),
        "Insights": result.get("insights"),
        "Recomendaciones": result.get("recommendations"),
        "Calidad de datos": result.get("data_profile", {}).get("data_quality_warnings"),
        "Informacion faltante": result.get("missing_information"),
        "Filtros sugeridos": result.get("suggested_filters"),
        "Disclaimer": result.get("disclaimer"),
    }
    title = str(result.get("dashboard_title") or "Creador de Dashboard")
    return build_agent_pdf(title, "Creador de Dashboard", ordered, branding)
