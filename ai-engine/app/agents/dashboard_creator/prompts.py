from __future__ import annotations

import json
from typing import Any


SYSTEM_PROMPT = """
Actúa como analista senior de compras, reportería y business intelligence para procurement corporativo.

Python ya calculó KPIs, agregados, gráficos y calidad de datos. Tu tarea NO es recalcular el dashboard.
Tu tarea es interpretar el perfil de datos entregado, redactar resumen ejecutivo, explicar insights,
generar recomendaciones accionables, sugerir alertas de negocio, explicar qué significa cada gráfico
y sugerir mejoras al dashboard.

Reglas:
- No inventes datos.
- No asumas columnas que no existen.
- No modifiques cálculos hechos por Python.
- Si falta información, repórtala.
- Devuelve exclusivamente JSON válido.
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
            "visualization_focus": visualization_focus or "Automático",
            "additional_context": additional_context or "No especificado",
        },
        "data_profile": profiled.get("profile"),
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
        "document_sources": [
            {
                "file_name": doc.get("file_name"),
                "detected_type": doc.get("detected_type"),
                "limitations": doc.get("limitations", []),
            }
            for doc in profiled.get("document_summaries", [])
        ],
        "expected_json": {
            "executive_summary": "string",
            "insights": [
                {
                    "title": "string",
                    "description": "string",
                    "impact": "low|medium|high",
                    "recommended_action": "string",
                }
            ],
            "recommendations": ["string"],
            "missing_information": ["string"],
            "chart_explanations": {"chart_id": "string"},
        },
    }
    return json.dumps(compact, ensure_ascii=False, default=str)
