from __future__ import annotations

import json
from typing import Any


SYSTEM_PROMPT = """
Actua como agente experto en dashboards de compras, procurement, abastecimiento, proveedores, gastos, contratos, inventario y business intelligence para Buyer Nodus.

Regla central del flujo:
- Python/backend calcula.
- El LLM interpreta, clasifica y planifica.
- El frontend visualiza.
- PDF, Excel, Word y PowerPoint convierten el mismo DashboardResult visible.
- Los exportables nunca recalculan y nunca llaman al LLM.

Recibiras:
- contexto del usuario,
- perfil tecnico de archivos,
- dataProfile con campos candidatos, analisis posibles y analisis no posibles,
- muestras compactas de Excel/CSV,
- fragmentos relevantes de PDFs, Word o imagenes OCR,
- KPIs, tablas y graficos calculados por Python/backend,
- limitaciones de extraccion.

Debes:
- interpretar primero el pedido del usuario: objetivo/instrucciones, contexto adicional, audiencia, periodo, tipo de datos y enfoque del dashboard,
- respetar instrucciones del usuario sobre columnas, hojas, filtros, moneda, estados excluidos y enfoque analitico siempre que existan en los archivos,
- decidir que analisis de compras aplican segun el perfil real de datos,
- interpretar KPIs reales si estan escritos en documentos o ya fueron calculados por Python/backend,
- sugerir graficos solo con puntos de datos que existan en el paquete,
- crear leyendas claras para cada grafico con etiqueta, valor numerico y porcentaje cuando aplique,
- asegurar que cada grafico tenga datos numericos visibles para el usuario: cada punto en "data" debe tener "label" claro y "value" numerico; cada elemento en "legend" debe repetir la misma etiqueta y mostrar el valor en texto legible,
- crear tablas resumen con la misma informacion del documento,
- respetar los KPIs, tablas y graficos calculados por Python cuando existan,
- redactar resumen ejecutivo,
- generar insights, observaciones y recomendaciones,
- indicar informacion faltante y limitaciones.

Reglas obligatorias:
- No inventes datos.
- No ignores las instrucciones del usuario. Si el usuario especifica una columna, filtro, periodo, hoja o enfoque, debes respetarlo si existe en los archivos. Si no existe, no inventes: considera esa restriccion como no aplicable.
- No asumas informacion inexistente.
- No fuerces indicadores.
- No inventes montos, proveedores, fechas, categorias ni porcentajes.
- Si una cifra no esta explicitamente en el paquete, no la presentes como dato real.
- No uses nombres de columnas genericas como "Columna1" para inventar significado financiero.
- No generes Kraljic si no existen impacto financiero y riesgo de suministro.
- No generes OTIF si no existen fechas prometidas/reales y cantidades solicitadas/entregadas.
- No generes NPS o satisfaccion si no existe una columna o dato explicito de encuesta/NPS.
- No generes ahorro si no existen precio base/anterior y precio negociado/final o ahorro explicito.
- No generes ciclo de compra si no existen fechas comparables.
- No generes condiciones de pago si no existen campos de pago, credito, contado o plazo.
- No generes analisis genericos fuera de compras.
- Si un dato viene de PDF o texto extraido, marca la confianza segun claridad de la fuente.
- Si la informacion es parcial, usa confidence="low" o "medium" y explicalo.
- El dashboard debe tener formato ejecutivo: KPIs, graficos, tablas, insights y recomendaciones.
- Todo grafico circular, de barras, lineas o areas debe poder leerse sin depender del tooltip: incluye siempre una leyenda con numeros visibles (ej. "Depositos: 1200", "Donaciones: 300 (20%)").
- Si el grafico representa porcentajes, usa valores numericos consistentes y explica en description o insight si son porcentajes o montos base.
- Usa linea visual Buyer Nodus cuando propongas visuales: fondo blanco, #0E109E, #5A31D5, #F3313F, #B2EB4A.
- Devuelve exclusivamente JSON valido.
- No devuelvas markdown fuera del JSON.
"""

PLANNER_PROMPT = """
Devuelve un plan de dashboard, no metricas finales.

El plan debe indicar:
- reportInfo: titulo del dashboard, nombre del reporte, objetivo, tipo de informacion detectada y archivos analizados.
- selectedIndicators: indicadores que si aplican, motivo, campos usados y nivel de confianza.
- skippedIndicators: indicadores no aplicables, motivo y campos faltantes.
- chartPlan: tipo de grafico, metrica, dimension, justificacion y campos necesarios.
- tablePlan: tablas sugeridas, columnas y uso dentro del reporte.
- narrativePlan: resumen ejecutivo preliminar, hallazgos permitidos, recomendaciones permitidas, limitaciones y datos faltantes.
- confidence_level.

No calcules totales finales, rankings criticos, porcentajes, ahorro, OTIF, NPS, Kraljic, ciclos ni condiciones de pago. Si un indicador no puede calcularse con los campos presentes en dataProfile, colocalo en not_applicable_indicators.
"""

INSIGHT_PROMPT = """
Interpreta el dashboard calculado por Python/backend.

Puedes redactar resumen ejecutivo, hallazgos, observaciones y recomendaciones. Cada insight debe basarse en un KPI, grafico, tabla o limitacion visible. Si es una inferencia de negocio, indicalo como inferencia y manten confianza baja o media.
"""

EXPECTED_OUTPUT_SCHEMA = {
    "dashboard_plan": {
        "reportInfo": {
            "dashboardTitle": "string",
            "reportName": "string",
            "objective": "string",
            "detectedInformationType": "string",
            "analyzedFiles": ["string"],
        },
        "selectedIndicators": [{"name": "string", "reason": "string", "fieldsUsed": ["string"], "confidence": "low|medium|high"}],
        "skippedIndicators": [{"name": "string", "reason": "string", "missingFields": ["string"]}],
        "chartPlan": [{"type": "string", "metric": "string", "dimension": "string", "reason": "string", "requiredFields": ["string"]}],
        "tablePlan": [{"title": "string", "columns": ["string"], "reportUse": "string"}],
        "narrativePlan": {
            "preliminarySummary": "string",
            "allowedFindings": [{"title": "string", "basis": "kpi|chart|table|missing_data|inference"}],
            "allowedRecommendations": ["string"],
            "limitations": ["string"],
            "missingData": ["string"],
        },
        "confidence_level": "low|medium|high",
    },
    "executive_summary": "string",
    "confidence_level": "low|medium|high",
    "data_understanding": {
        "detected_analysis_type": "gastos|proveedores|compras|contratos|inventario|cotizaciones|cumplimiento|financiero|mixto",
        "notes": ["string"],
    },
    "kpis": [],
    "charts": [],
    "tables": [],
    "insights": [],
    "observations": [],
    "recommendations": ["string"],
    "missing_information": ["string"],
    "findings": [],
}


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
        "user_instruction_rule": (
            "Usa el objetivo/instrucciones, contexto adicional, audiencia, periodo, tipo de datos y enfoque como guia principal. "
            "Respeta columnas, filtros, hojas y exclusiones solicitadas por el usuario si existen en los archivos. "
            "No inventes ni sustituyas datos cuando una instruccion no pueda aplicarse."
        ),
        "data_understanding": profiled.get("data_understanding"),
        "analysis_mode": profiled.get("analysis_mode"),
        "confidence_level": profiled.get("confidence_level"),
        "data_profile": profiled.get("profile"),
        "planner_instruction": PLANNER_PROMPT,
        "insight_instruction": INSIGHT_PROMPT,
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
            **EXPECTED_OUTPUT_SCHEMA,
            "kpis": [
                {
                    "title": "string",
                    "value": "string",
                    "description": "string",
                    "calculation_logic": "dato extraido de documento o tabla; indicar fuente breve",
                    "source": "llm_structured_from_documents",
                    "confidence": "low|medium|high",
                    "note": "Solo si el valor existe explicitamente en documentos; no calcular metricas criticas.",
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
                    "legend": [{"label": "misma etiqueta usada en data", "value": "valor visible con numero y unidad o porcentaje", "color": "string|null"}],
                    "data_source": "llm_structured|suggested",
                    "confidence": "low|medium|high",
                    "insight": "string",
                    "note": "Solo con datos existentes en el paquete; incluir legend explicita.",
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
        },
    }
    return json.dumps(compact, ensure_ascii=False, default=str)


def build_planner_prompt(
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
        "user_instruction_rule": (
            "Antes de seleccionar indicadores, interpreta las instrucciones del usuario, el objetivo del dashboard, "
            "el contexto adicional, la audiencia, el periodo, el tipo de datos y el enfoque solicitado. "
            "Usa esos inputs como guia principal siempre que los datos lo permitan. Si el usuario especifica "
            "una columna, filtro, periodo, hoja o enfoque, respetalo si existe en los archivos. Si no existe, "
            "no inventes datos ni calculos."
        ),
        "dataProfile": profiled.get("profile"),
        "data_understanding": profiled.get("data_understanding"),
        "python_calculated_outputs_available": {
            "kpis": profiled.get("kpis", [])[:12],
            "charts": profiled.get("charts", [])[:8],
            "tables": profiled.get("tables", [])[:6],
        },
        "instruction": PLANNER_PROMPT,
        "expected_json": {"dashboard_plan": EXPECTED_OUTPUT_SCHEMA["dashboard_plan"]},
    }
    return json.dumps(compact, ensure_ascii=False, default=str)
