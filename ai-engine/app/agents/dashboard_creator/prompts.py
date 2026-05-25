from __future__ import annotations

import json
from typing import Any


SYSTEM_PROMPT = """
Actua como analista senior de compras, reporteria y business intelligence para procurement corporativo.

Tu trabajo en este agente es complementar los calculos confiables de Python y convertir informacion documental o parcialmente estructurada en un dashboard visual util.

Recibiras:
- contexto del usuario,
- perfil tecnico de archivos,
- muestras compactas de Excel/CSV,
- fragmentos relevantes de PDFs, Word o imagenes OCR,
- limitaciones de extraccion.

Debes:
- extraer KPIs reales si estan escritos en los documentos o tablas,
- crear graficos con puntos de datos que existan en el paquete,
- crear leyendas claras para cada grafico con etiqueta y valor cuando aplique,
- crear tablas resumen con la misma informacion del documento,
- respetar los KPIs, tablas y graficos calculados por Python cuando existan,
- redactar resumen ejecutivo,
- generar insights, observaciones y recomendaciones,
- indicar informacion faltante y limitaciones.

Reglas obligatorias:
- No inventes datos.
- No inventes montos, proveedores, fechas, categorias ni porcentajes.
- Si una cifra no esta explicitamente en el paquete, no la presentes como dato real.
- No uses nombres de columnas genericas como "Columna1" para inventar significado financiero.
- Si un dato viene de PDF o texto extraido, marca la confianza segun claridad de la fuente.
- Si la informacion es parcial, usa confidence="low" o "medium" y explicalo.
- El dashboard debe tener formato ejecutivo: KPIs, graficos, tablas, insights y recomendaciones.
- Devuelve exclusivamente JSON valido.
- No devuelvas markdown fuera del JSON.
"""


def build_insight_prompt(
    *,
    title: str,
    objective: str,
    audience: str | None,
    period: str | None,
    data_type: str | None,
    visualization_focus: str | None,
    additional_context: str | None,
    profiled: dict[str, Any],
) -> str:
    compact = {
        "dashboard_context": {
            "title": title,
            "objective": objective,
            "audience": audience or "No especificado",
            "period": period or "No especificado",
            "data_type": data_type or "No especificado",
            "visualization_focus": visualization_focus or "Automatico",
            "additional_context": additional_context or "No especificado",
        },
        "data_understanding": profiled.get("data_understanding"),
        "analysis_mode": profiled.get("analysis_mode"),
        "confidence_level": profiled.get("confidence_level"),
        "data_profile": profiled.get("profile"),
        "python_profile_only": {
            "detected_columns": profiled.get("profile", {}).get("detected_columns", [])[:80],
            "date_columns": profiled.get("profile", {}).get("date_columns", []),
            "numeric_columns": profiled.get("profile", {}).get("numeric_columns", []),
            "category_columns": profiled.get("profile", {}).get("category_columns", []),
            "warnings": profiled.get("profile", {}).get("data_quality_warnings", [])[:12],
        },
        "python_dashboard_outputs": {
            "kpis": profiled.get("kpis", [])[:12],
            "charts": profiled.get("charts", [])[:8],
            "tables": profiled.get("tables", [])[:6],
            "insights": profiled.get("insights", [])[:8],
            "suggested_filters": profiled.get("suggested_filters", []),
        },
        "document_sources": [
            {
                "file_name": doc.get("file_name"),
                "detected_type": doc.get("detected_type"),
                "relevant_findings": doc.get("relevant_findings", []),
                "excerpt": doc.get("llm_excerpt"),
                "limitations": doc.get("limitations", []),
            }
            for doc in profiled.get("document_summaries", [])[:10]
        ],
        "expected_json": {
            "executive_summary": "string",
            "confidence_level": "low|medium|high",
            "data_understanding": {
                "detected_analysis_type": "gastos|proveedores|compras|contratos|inventario|cotizaciones|cumplimiento|financiero|mixto",
                "notes": ["string"],
            },
            "kpis": [
                {
                    "title": "string",
                    "value": "string",
                    "description": "string",
                    "calculation_logic": "dato extraido de documento o tabla; indicar fuente breve",
                    "source": "llm_structured_from_documents",
                    "confidence": "low|medium|high",
                }
            ],
            "charts": [
                {
                    "chart_id": "string",
                    "title": "string",
                    "type": "bar|horizontal_bar|line|area|pie|donut|stacked_bar|table|kpi|matrix|alert",
                    "description": "string",
                    "x_axis": "string|null",
                    "y_axis": "string|null",
                    "data": [{"label": "string", "value": 0, "group": "string|null"}],
                    "legend": [{"label": "string", "value": "string|null", "color": "string|null"}],
                    "data_source": "llm_structured|suggested",
                    "confidence": "low|medium|high",
                    "insight": "string",
                }
            ],
            "tables": [
                {
                    "title": "string",
                    "description": "string",
                    "source": "llm_structured_from_documents",
                    "columns": ["string"],
                    "rows": [{"columna": "valor"}],
                }
            ],
            "insights": [
                {
                    "title": "string",
                    "description": "string",
                    "impact": "low|medium|high",
                    "recommended_action": "string",
                }
            ],
            "observations": [
                {
                    "title": "string",
                    "description": "string",
                    "type": "opportunity|risk|warning|trend|data_quality",
                }
            ],
            "recommendations": ["string"],
            "missing_information": ["string"],
            "chart_explanations": {"chart_id": "string"},
        },
    }
    return json.dumps(compact, ensure_ascii=False, default=str)
