from __future__ import annotations

from typing import Any


def build_basic_insights(profiled: dict[str, Any]) -> tuple[str, list[dict[str, Any]], list[str], list[dict[str, Any]]]:
    profile = profiled["profile"]
    insights = list(profiled.get("insights", []))
    recommendations: list[str] = []
    has_rows = bool(profile["rows_detected"])
    has_docs = bool(profiled.get("document_summaries"))

    if has_rows:
        recommendations.append("Validar que las columnas detectadas coincidan con el significado real del negocio antes de presentar el dashboard.")
    if profile["data_quality_warnings"]:
        recommendations.append("Corregir valores faltantes, columnas sin monto o formatos inconsistentes para mejorar la precision.")
    if not profile["numeric_columns"]:
        recommendations.append("Agregar columnas numericas de monto, costo, cantidad o valor para habilitar KPIs financieros.")
    if not profile["date_columns"]:
        recommendations.append("Agregar una columna de fecha o periodo para analizar tendencias y variaciones.")
    if not profile["category_columns"]:
        recommendations.append("Agregar columnas de proveedor, categoria, area o centro de costo para segmentar el analisis.")
    if has_docs and not has_rows:
        recommendations.append("Para un dashboard cuantitativo, subir tambien un Excel o CSV con datos tabulares.")

    if not insights:
        if has_rows:
            insights.append(
                {
                    "title": "Dashboard construido desde datos tabulares",
                    "description": "Se calcularon KPIs, rankings, tablas y graficos con Python a partir de las columnas detectadas.",
                    "impact": "medium",
                    "recommended_action": "Revisar los campos detectados y ajustar nombres de columnas si algun KPI no representa el negocio.",
                }
            )
        else:
            insights.append(
                {
                    "title": "Datos insuficientes para dashboard numerico",
                    "description": "No se encontro una tabla estructurada suficiente; el resultado se apoya en texto/documentos extraidos.",
                    "impact": "medium",
                    "recommended_action": "Subir Excel o CSV con columnas de fecha, proveedor/categoria y monto.",
                }
            )

    summary_parts = [
        f"Se procesaron {profile['files_processed']} archivo(s)",
        f"{profile['rows_detected']} filas tabulares",
        f"{profile['columns_detected']} columnas",
    ]
    if profile["numeric_columns"]:
        summary_parts.append(f"columnas numericas: {', '.join(profile['numeric_columns'][:4])}")
    if profile["date_columns"]:
        summary_parts.append(f"fechas/periodos: {', '.join(profile['date_columns'][:3])}")
    if has_docs:
        summary_parts.append(f"{len(profiled.get('document_summaries', []))} documento(s) de soporte")

    summary = (
        ". ".join(summary_parts)
        + ". El dashboard fue generado principalmente con calculos de Python; la IA solo interpreta resultados cuando esta disponible."
    )

    layout = [
        {"section": "Resumen ejecutivo", "component_type": "insight", "title": "Resumen ejecutivo", "priority": 1},
        {"section": "KPIs", "component_type": "kpi", "title": "KPIs principales", "priority": 2},
        {"section": "Visualizaciones", "component_type": "chart", "title": "Graficos principales", "priority": 3},
        {"section": "Tablas", "component_type": "table", "title": "Tablas resumen", "priority": 4},
    ]

    return summary, insights, list(dict.fromkeys(recommendations)), layout
