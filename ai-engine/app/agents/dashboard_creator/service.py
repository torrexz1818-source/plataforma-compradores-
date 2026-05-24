from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile

from app.agents.dashboard_creator.dashboard_builder import build_dashboard_result
from app.agents.dashboard_creator.data_profiler import profile_files
from app.agents.dashboard_creator.insight_generator import build_basic_insights
from app.agents.dashboard_creator.prompts import SYSTEM_PROMPT, build_insight_prompt
from app.agents.dashboard_creator.quality_validator import validate_dashboard_request
from app.agents.dashboard_creator.schemas import DashboardResult
from app.ai.llm_client import analyze_with_openai
from app.config import get_settings
from app.document_processing.file_detector import validate_allowed_file
from app.utils.temp_files import cleanup_files, save_upload_temporarily


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _merge_unique(base: list[Any], additions: list[Any]) -> list[Any]:
    seen = set()
    merged = []
    for item in [*base, *additions]:
        marker = str(item)
        if marker in seen:
            continue
        seen.add(marker)
        merged.append(item)
    return merged


def _merge_dashboard_items(base: list[dict[str, Any]], additions: list[dict[str, Any]], key: str | None = None, limit: int = 12) -> list[dict[str, Any]]:
    seen = set()
    merged: list[dict[str, Any]] = []
    for item in [*base, *additions]:
        if not isinstance(item, dict):
            continue
        marker = str(item.get(key)) if key and item.get(key) else str(item)
        if marker in seen:
            continue
        seen.add(marker)
        merged.append(item)
        if len(merged) >= limit:
            break
    return merged


def _build_quality_observations(profiled: dict[str, Any]) -> list[dict[str, Any]]:
    profile = profiled.get("profile", {})
    observations: list[dict[str, Any]] = []
    for warning in profile.get("data_quality_warnings", [])[:5]:
        observations.append(
            {
                "title": "Advertencia de calidad de datos",
                "description": str(warning),
                "type": "data_quality",
            }
        )
    if profiled.get("confidence_reason"):
        observations.append(
            {
                "title": "Base de confianza",
                "description": str(profiled["confidence_reason"]),
                "type": "data_quality",
            }
        )
    return observations


def _normalize_llm_kpis(items: list[Any]) -> list[dict[str, Any]]:
    normalized = []
    for index, item in enumerate(items[:8], start=1):
        if not isinstance(item, dict):
            continue
        normalized.append(
            {
                "title": str(item.get("title") or f"KPI documental {index}")[:80],
                "value": str(item.get("value") or "No especificado")[:120],
                "description": str(item.get("description") or "KPI estructurado desde documentos.")[:260],
                "calculation_logic": str(item.get("calculation_logic") or "Extraido/sintetizado desde documentos; validar fuente.")[:220],
                "source": "llm_structured_from_documents",
                "confidence": item.get("confidence") if item.get("confidence") in {"low", "medium", "high"} else "low",
            }
        )
    return normalized


def _normalize_llm_tables(items: list[Any]) -> list[dict[str, Any]]:
    normalized = []
    for index, item in enumerate(items[:4], start=1):
        if not isinstance(item, dict):
            continue
        rows = [row for row in _as_list(item.get("rows")) if isinstance(row, dict)][:12]
        columns = [str(column) for column in _as_list(item.get("columns"))[:8]]
        if not columns and rows:
            columns = list(rows[0].keys())[:8]
        if not columns:
            continue
        normalized.append(
            {
                "title": str(item.get("title") or f"Tabla documental {index}")[:90],
                "description": str(item.get("description") or "Tabla estructurada desde documentos.")[:260],
                "source": "llm_structured_from_documents",
                "columns": columns,
                "rows": rows,
            }
        )
    return normalized


def _normalize_llm_charts(items: list[Any]) -> list[dict[str, Any]]:
    allowed_types = {"bar", "horizontal_bar", "line", "area", "pie", "donut", "stacked_bar", "table", "kpi", "matrix", "alert"}
    normalized = []
    for index, item in enumerate(items[:4], start=1):
        if not isinstance(item, dict):
            continue
        points = []
        for point in _as_list(item.get("data"))[:10]:
            if not isinstance(point, dict):
                continue
            try:
                value = float(point.get("value") or 0)
            except (TypeError, ValueError):
                value = 0
            points.append({"label": str(point.get("label") or "Sin etiqueta")[:80], "value": value, "group": point.get("group")})
        data_source = item.get("data_source") if item.get("data_source") in {"llm_structured", "suggested"} else "suggested"
        if not points and data_source != "suggested":
            continue
        normalized.append(
            {
                "chart_id": str(item.get("chart_id") or f"llm_chart_{index}")[:60],
                "title": str(item.get("title") or f"Grafico sugerido {index}")[:90],
                "type": item.get("type") if item.get("type") in allowed_types else "bar",
                "description": str(item.get("description") or "Visualizacion sugerida desde documentos.")[:260],
                "x_axis": item.get("x_axis"),
                "y_axis": item.get("y_axis"),
                "data": points,
                "data_source": data_source,
                "confidence": item.get("confidence") if item.get("confidence") in {"low", "medium", "high"} else "low",
                "insight": str(item.get("insight") or "Validar datos fuente antes de presentar.")[:320],
            }
        )
    return normalized


def _normalize_observations(items: list[Any]) -> list[dict[str, Any]]:
    allowed_types = {"opportunity", "risk", "warning", "trend", "data_quality"}
    normalized = []
    for index, item in enumerate(items[:8], start=1):
        if not isinstance(item, dict):
            continue
        normalized.append(
            {
                "title": str(item.get("title") or f"Observacion {index}")[:90],
                "description": str(item.get("description") or "Observacion generada desde la informacion disponible.")[:320],
                "type": item.get("type") if item.get("type") in allowed_types else "warning",
            }
        )
    return normalized


def _normalize_insights(items: list[Any]) -> list[dict[str, Any]]:
    normalized = []
    for index, item in enumerate(items[:8], start=1):
        if not isinstance(item, dict):
            continue
        normalized.append(
            {
                "title": str(item.get("title") or f"Insight {index}")[:90],
                "description": str(item.get("description") or "Insight generado desde la informacion disponible.")[:360],
                "impact": item.get("impact") if item.get("impact") in {"low", "medium", "high"} else "medium",
                "recommended_action": str(item.get("recommended_action") or "Validar con el usuario comprador.")[:260],
            }
        )
    return normalized


async def generate_dashboard(
    *,
    title: str,
    objective: str,
    audience: str | None,
    period: str | None,
    data_type: str | None,
    visualization_focus: str | None,
    additional_context: str | None,
    use_llm_insights: bool,
    files: list[UploadFile],
) -> DashboardResult:
    started_at = time.perf_counter()
    settings = get_settings()
    validate_dashboard_request(title, objective, files)

    temp_paths: list[Path] = []
    try:
        for upload in files:
            validate_allowed_file(upload.filename or "")
            temp_paths.append(await save_upload_temporarily(upload, settings.max_file_size_mb))

        profiled = profile_files([(path, upload.filename or path.name) for path, upload in zip(temp_paths, files)])
        basic_summary, basic_insights, basic_recommendations, _ = build_basic_insights(profiled)

        executive_summary = basic_summary
        insights = basic_insights
        recommendations = basic_recommendations
        observations = [
            {
                "title": "Modo de analisis",
                "description": f"Se genero en modo {profiled.get('analysis_mode', 'structured_data')} con confianza {profiled.get('confidence_level', 'medium')}.",
                "type": "data_quality",
            }
        ]
        observations = _merge_unique(observations, _build_quality_observations(profiled))
        missing_information = []
        llm_used = False

        if not profiled["profile"]["numeric_columns"]:
            missing_information.append("No se detectaron columnas numericas claras para KPIs financieros.")
        if not profiled["profile"]["date_columns"]:
            missing_information.append("No se detecto una columna de fecha o periodo para tendencias.")

        has_document_sources = any(item.get("detected_type") not in {"xlsx", "csv"} for item in profiled.get("source_files", []))
        has_low_structure = profiled.get("data_understanding", {}).get("structure_level") in {"low", "medium"}
        should_use_llm = use_llm_insights or has_document_sources or has_low_structure

        if should_use_llm:
            try:
                llm_result = await analyze_with_openai(
                    build_insight_prompt(
                        title=title,
                        objective=objective,
                        audience=audience,
                        period=period,
                        data_type=data_type,
                        visualization_focus=visualization_focus,
                        additional_context=additional_context,
                        profiled=profiled,
                    ),
                    SYSTEM_PROMPT,
                )
                executive_summary = str(llm_result.get("executive_summary") or executive_summary)
                if llm_result.get("confidence_level") in {"low", "medium", "high"}:
                    profiled["confidence_level"] = llm_result["confidence_level"]

                llm_understanding = llm_result.get("data_understanding")
                if isinstance(llm_understanding, dict):
                    if llm_understanding.get("detected_analysis_type"):
                        profiled["data_understanding"]["detected_analysis_type"] = llm_understanding["detected_analysis_type"]
                    if isinstance(llm_understanding.get("notes"), list):
                        profiled["data_understanding"]["notes"] = _merge_unique(
                            profiled["data_understanding"].get("notes", []),
                            [str(item) for item in llm_understanding["notes"]],
                        )

                llm_kpis = _normalize_llm_kpis(_as_list(llm_result.get("kpis")))
                llm_charts = _normalize_llm_charts(_as_list(llm_result.get("charts")))
                llm_tables = _normalize_llm_tables(_as_list(llm_result.get("tables")))
                profiled["kpis"] = _merge_dashboard_items(profiled.get("kpis", []), llm_kpis, "title", 12)
                profiled["charts"] = _merge_dashboard_items(profiled.get("charts", []), llm_charts, "chart_id", 8)
                profiled["tables"] = _merge_dashboard_items(profiled.get("tables", []), llm_tables, "title", 6)

                if isinstance(llm_result.get("insights"), list):
                    insights = _merge_unique(insights, _normalize_insights(llm_result["insights"]))
                observations = _merge_unique(observations, _normalize_observations(_as_list(llm_result.get("observations"))))
                if isinstance(llm_result.get("recommendations"), list):
                    recommendations = _merge_unique(recommendations, [str(item) for item in llm_result["recommendations"]])
                if isinstance(llm_result.get("missing_information"), list):
                    missing_information = _merge_unique(missing_information, [str(item) for item in llm_result["missing_information"]])

                chart_explanations = llm_result.get("chart_explanations")
                if isinstance(chart_explanations, dict):
                    for chart in profiled.get("charts", []):
                        explanation = chart_explanations.get(chart.get("chart_id"))
                        if explanation:
                            chart["insight"] = str(explanation)
                llm_used = True
            except HTTPException:
                recommendations.append("El LLM no estuvo disponible; se genero el dashboard con calculos y sintesis basica de Python.")

        result = build_dashboard_result(
            title=title,
            objective=objective,
            audience=audience,
            period=period,
            data_type=data_type,
            profiled=profiled,
            executive_summary=executive_summary,
            insights=insights,
            observations=observations,
            recommendations=recommendations,
            missing_information=missing_information,
            llm_used=llm_used,
            model_provider="OpenAI" if llm_used else None,
            model_name=settings.openai_model if llm_used else None,
            latency_ms=int((time.perf_counter() - started_at) * 1000),
        )
        return DashboardResult.model_validate(result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="No se pudo generar el dashboard.") from exc
    finally:
        if settings.delete_temp_files:
            cleanup_files(temp_paths)
