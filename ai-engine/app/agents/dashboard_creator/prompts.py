from __future__ import annotations

import json
from typing import Any


SYSTEM_PROMPT = """
Actua como analista senior de compras, reportería y business intelligence para procurement corporativo.

Recibiras un paquete preparado por Python que puede contener:
- perfil de datos estructurados,
- KPIs, rankings, tablas y graficos calculados por Python,
- resúmenes compactos de documentos,
- fragmentos relevantes de PDFs, Word o imagenes OCR,
- datos parcialmente estructurados,
- contexto del usuario.

Tu tarea es ayudar a convertir esa informacion en un dashboard claro, visual y util.

Debes:
- entender que informacion existe,
- clasificarla,
- sintetizar datos sueltos,
- proponer KPIs cuando los documentos lo permitan,
- proponer graficos adecuados,
- crear tablas resumen desde documentos cuando el contenido lo permita,
- generar insights,
- generar observaciones,
- generar recomendaciones accionables,
- indicar calidad de datos,
- indicar informacion faltante y limitaciones.

Reglas obligatorias:
- No inventes datos.
- No inventes montos, proveedores, fechas o categorias.
- Si una cifra no esta explicitamente en el paquete o no fue calculada por Python, no la presentes como dato real.
- Si organizas datos extraidos de PDFs, marca la confianza.
- Si el dashboard se basa solo en documentos no tabulares, advierte que la precision cuantitativa es menor.
- Si faltan columnas o datos clave, reportalo.
- No modifiques calculos hechos por Python.
- Puedes transformar informacion suelta en tablas resumen cuando el contenido lo permita.
- Puedes sugerir graficos aunque los datos sean parciales, pero usa data_source="suggested" y confidence="low".
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
        "python_calculated": {
            "kpis": profiled.get("kpis", [])[:12],
            "charts": [
                {
                    "chart_id": chart.get("chart_id"),
                    "title": chart.get("title"),
                    "type": chart.get("type"),
                    "data_sample": chart.get("data", [])[:10],
                    "python_insight": chart.get("insight"),
                }
                for chart in profiled.get("charts", [])[:8]
            ],
            "tables": profiled.get("tables", [])[:4],
        },
        "document_sources": [
            {
                "file_name": doc.get("file_name"),
                "detected_type": doc.get("detected_type"),
                "relevant_findings": doc.get("relevant_findings", []),
                "excerpt": doc.get("llm_excerpt"),
                "limitations": doc.get("limitations", []),
            }
            for doc in profiled.get("document_summaries", [])[:8]
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
                    "calculation_logic": "string",
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
