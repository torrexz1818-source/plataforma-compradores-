from __future__ import annotations

import time
from pathlib import Path

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
        missing_information = []
        llm_used = False

        if not profiled["profile"]["numeric_columns"]:
            missing_information.append("No se detectaron columnas numéricas claras para KPIs financieros.")
        if not profiled["profile"]["date_columns"]:
            missing_information.append("No se detectó una columna de fecha o periodo para tendencias.")

        if use_llm_insights:
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
                if isinstance(llm_result.get("insights"), list):
                    insights = llm_result["insights"]
                if isinstance(llm_result.get("recommendations"), list):
                    recommendations = [str(item) for item in llm_result["recommendations"]]
                if isinstance(llm_result.get("missing_information"), list):
                    missing_information = [*missing_information, *[str(item) for item in llm_result["missing_information"]]]
                chart_explanations = llm_result.get("chart_explanations")
                if isinstance(chart_explanations, dict):
                    for chart in profiled.get("charts", []):
                        explanation = chart_explanations.get(chart.get("chart_id"))
                        if explanation:
                            chart["insight"] = str(explanation)
                llm_used = True
            except HTTPException:
                recommendations.append(
                    "Insights generados automáticamente por análisis estadístico básico. La interpretación avanzada con IA no está disponible temporalmente."
                )

        result = build_dashboard_result(
            title=title,
            objective=objective,
            audience=audience,
            period=period,
            data_type=data_type,
            profiled=profiled,
            executive_summary=executive_summary,
            insights=insights,
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
