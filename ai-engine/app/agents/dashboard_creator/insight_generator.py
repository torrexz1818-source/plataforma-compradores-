from __future__ import annotations

from typing import Any


def build_basic_insights(profiled: dict[str, Any]) -> tuple[str, list[dict[str, Any]], list[str], list[dict[str, Any]]]:
    profile = profiled["profile"]
    insights = list(profiled.get("insights", []))
    recommendations: list[str] = []

    if profile["rows_detected"]:
        recommendations.append("Validar columnas clave y usar filtros por periodo, proveedor o categoría antes de presentar a gerencia.")
    if profile["data_quality_warnings"]:
        recommendations.append("Corregir valores faltantes o formatos inconsistentes para mejorar precisión del dashboard.")
    if not profile["numeric_columns"]:
        recommendations.append("Agregar columnas numéricas de monto, cantidad o valor para calcular KPIs financieros.")
    if not profile["date_columns"]:
        recommendations.append("Agregar una columna de fecha o periodo para analizar tendencias.")

    if not insights:
        insights.append(
            {
                "title": "Dashboard generado con análisis básico",
                "description": "Se construyeron KPIs y visualizaciones a partir de las columnas detectadas automáticamente.",
                "impact": "medium",
                "recommended_action": "Revisar que las columnas detectadas representen correctamente el negocio.",
            }
        )

    summary = (
        f"Se procesaron {profile['files_processed']} archivo(s), con {profile['rows_detected']} filas y "
        f"{profile['columns_detected']} columnas detectadas. El dashboard prioriza KPIs, rankings y tendencias "
        "calculadas automáticamente por Python."
    )

    layout = [
        {"section": "Resumen ejecutivo", "component_type": "insight", "title": "Resumen ejecutivo", "priority": 1},
        {"section": "KPIs", "component_type": "kpi", "title": "KPIs principales", "priority": 2},
        {"section": "Visualizaciones", "component_type": "chart", "title": "Gráficos principales", "priority": 3},
        {"section": "Tablas", "component_type": "table", "title": "Tablas resumen", "priority": 4},
    ]

    return summary, insights, recommendations, layout
