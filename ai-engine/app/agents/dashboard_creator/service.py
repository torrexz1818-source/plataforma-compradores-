from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile

from app.agents.dashboard_creator.dashboard_builder import build_dashboard_result
from app.agents.dashboard_creator.data_profiler import profile_files
from app.agents.dashboard_creator.insight_generator import build_basic_insights
from app.agents.dashboard_creator.prompts import SYSTEM_PROMPT, build_insight_prompt, build_planner_prompt
from app.agents.dashboard_creator.quality_validator import validate_dashboard_request, validate_dashboard_result_payload
from app.agents.dashboard_creator.schemas import DashboardResult
from app.ai.llm_client import generate_agent_response
from app.config import get_settings
from app.document_processing.file_detector import validate_allowed_file
from app.utils.google_pubsub_notifier import publish_dashboard_completed_event
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


def _dashboard_completed_payload(result: DashboardResult, files_count: int) -> dict[str, Any]:
    metadata = result.metadata
    generated_at = metadata.generated_at if metadata else None
    report_name = metadata.report_name if metadata else None
    dashboard_id_source = f"{result.dashboard_title}-{generated_at or ''}".strip("-")
    dashboard_id = dashboard_id_source.lower().replace(" ", "-")[:140] or result.dashboard_title.lower().replace(" ", "-")
    return {
        "event": "dashboard_creator.completed",
        "agentKey": "dashboard_creator",
        "userId": metadata.user if metadata else None,
        "dashboardId": dashboard_id,
        "reportName": report_name or result.dashboard_title,
        "status": "completed",
        "generatedAt": generated_at,
        "filesCount": files_count,
        "downloadFormats": ["pdf", "excel", "pptx"],
    }


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
                "legend": [
                    {
                        "label": str(legend.get("label") or "")[:80],
                        "value": str(legend.get("value"))[:80] if legend.get("value") is not None else None,
                        "color": str(legend.get("color"))[:30] if legend.get("color") else None,
                    }
                    for legend in _as_list(item.get("legend"))[:12]
                    if isinstance(legend, dict) and legend.get("label")
                ],
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


def _normalize_dashboard_plan(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    allowed_confidence = {"low", "medium", "high"}
    report_info = item.get("reportInfo") if isinstance(item.get("reportInfo"), dict) else {}
    narrative_plan = item.get("narrativePlan") if isinstance(item.get("narrativePlan"), dict) else {}
    selected = _as_list(item.get("selectedIndicators") or item.get("applicable_indicators"))
    skipped = _as_list(item.get("skippedIndicators") or item.get("not_applicable_indicators"))
    chart_plan = _as_list(item.get("chartPlan") or item.get("suggested_charts"))
    table_plan = _as_list(item.get("tablePlan") or item.get("suggested_tables"))
    return {
        "title": item.get("title") or report_info.get("dashboardTitle"),
        "report_name": item.get("report_name") or report_info.get("reportName"),
        "objective": item.get("objective") or report_info.get("objective"),
        "reportInfo": report_info,
        "selectedIndicators": selected[:16],
        "skippedIndicators": skipped[:16],
        "chartPlan": chart_plan[:10],
        "tablePlan": table_plan[:10],
        "narrativePlan": narrative_plan,
        "applicable_indicators": selected[:16],
        "not_applicable_indicators": skipped[:16],
        "suggested_charts": chart_plan[:10],
        "suggested_tables": table_plan[:10],
        "preliminary_summary": item.get("preliminary_summary") or narrative_plan.get("preliminarySummary"),
        "allowed_findings": _as_list(item.get("allowed_findings") or narrative_plan.get("allowedFindings"))[:12],
        "allowed_recommendations": [str(value) for value in _as_list(item.get("allowed_recommendations") or narrative_plan.get("allowedRecommendations"))[:12]],
        "limitations": [str(value) for value in _as_list(item.get("limitations") or narrative_plan.get("limitations") or narrative_plan.get("missingData"))[:12]],
        "confidence_level": item.get("confidence_level") if item.get("confidence_level") in allowed_confidence else "medium",
    }


def _plan_supported_by_profile(plan_item: dict[str, Any], possible_codes: set[str], candidates: dict[str, Any]) -> tuple[bool, list[str]]:
    fields = _as_list(plan_item.get("fieldsUsed") or plan_item.get("requiredFields") or plan_item.get("required_fields") or plan_item.get("missingFields"))
    normalized_fields = [str(field) for field in fields]
    missing = [field for field in normalized_fields if field not in candidates and field.replace(" ", "_") not in candidates]
    name = str(plan_item.get("name") or plan_item.get("metric") or plan_item.get("title") or "").lower()
    protected = {
        "kraljic": "kraljic",
        "otif": "otif",
        "nps": "nps",
        "ahorro": "ahorro",
        "ciclo": "ciclo_compra",
        "pago": "condiciones_pago",
    }
    for keyword, code in protected.items():
        if keyword in name and code not in possible_codes:
            return False, missing or [code]
    return not missing, missing


def _validate_dashboard_plan(profiled: dict[str, Any], dashboard_plan: dict[str, Any] | None) -> tuple[dict[str, Any] | None, list[str]]:
    if not dashboard_plan:
        return None, []
    profile = profiled.get("profile", {})
    candidates = profile.get("candidateFields", {})
    possible_codes = {str(item.get("analysis")) for item in profile.get("possibleAnalyses", []) if isinstance(item, dict)}
    warnings: list[str] = []
    selected = []
    skipped = list(_as_list(dashboard_plan.get("skippedIndicators")))
    for item in _as_list(dashboard_plan.get("selectedIndicators")):
        if not isinstance(item, dict):
            continue
        supported, missing = _plan_supported_by_profile(item, possible_codes, candidates)
        if supported:
            selected.append(item)
        else:
            skipped.append({"name": item.get("name") or item.get("metric") or "Indicador no calculable", "reason": "No se calculo este indicador porque faltan columnas necesarias.", "missingFields": missing})
            warnings.append(f"No se calculo {item.get('name') or item.get('metric') or 'un indicador'} porque faltan columnas necesarias.")
    dashboard_plan["selectedIndicators"] = selected
    dashboard_plan["skippedIndicators"] = skipped[:24]
    dashboard_plan["applicable_indicators"] = selected
    dashboard_plan["not_applicable_indicators"] = dashboard_plan["skippedIndicators"]
    return dashboard_plan, warnings


def _normalize_findings(items: list[Any]) -> list[dict[str, Any]]:
    normalized = []
    for index, item in enumerate(items[:10], start=1):
        if not isinstance(item, dict):
            continue
        basis = str(item.get("basis") or item.get("source_component") or "")
        inferred = basis == "inference" or bool(item.get("inferred"))
        description = str(item.get("description") or item.get("basis") or "").strip()
        evidence = str(item.get("evidence") or item.get("basis") or "").strip()
        if description.lower() in {"", "chart", "kpi", "table"}:
            continue
        normalized.append(
            {
                "title": str(item.get("title") or f"Hallazgo {index}")[:90],
                "description": description[:360],
                "evidence": evidence[:220] or None,
                "source_component": basis[:80] or None,
                "confidence": item.get("confidence") if item.get("confidence") in {"low", "medium", "high"} else ("low" if inferred else "medium"),
                "inferred": inferred,
            }
        )
    return normalized


def _missing_data_items(profiled: dict[str, Any], missing_information: list[str], dashboard_plan: dict[str, Any] | None) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for analysis in profiled.get("profile", {}).get("notPossibleAnalyses", [])[:12]:
        if not isinstance(analysis, dict):
            continue
        items.append(
            {
                "indicator": str(analysis.get("label") or analysis.get("analysis") or "Indicador no calculable"),
                "reason": str(analysis.get("reason") or "Faltan campos requeridos."),
                "required_fields": [str(field) for field in _as_list(analysis.get("missing_fields"))],
            }
        )
    if dashboard_plan:
        for indicator in _as_list(dashboard_plan.get("not_applicable_indicators") or dashboard_plan.get("skippedIndicators"))[:12]:
            if not isinstance(indicator, dict):
                continue
            items.append(
                {
                    "indicator": str(indicator.get("name") or indicator.get("metric") or "Indicador no aplicable"),
                    "reason": str(indicator.get("reason") or "No hay datos suficientes."),
                    "required_fields": [str(field) for field in _as_list(indicator.get("missing_fields") or indicator.get("missingFields"))],
                }
            )
    for text in missing_information[:12]:
        items.append({"indicator": "Informacion faltante", "reason": str(text), "required_fields": []})
    return _merge_dashboard_items(items, [], key="indicator", limit=24)


def _validate_dashboard_outputs(profiled: dict[str, Any], missing_information: list[str]) -> list[str]:
    warnings: list[str] = []
    valid_kpis = []
    for kpi in profiled.get("kpis", []):
        if not isinstance(kpi, dict):
            continue
        source = kpi.get("source")
        if source not in {"python", "backend", "calculated", "llm_structured_from_documents"}:
            kpi["source"] = "python"
        if source == "llm_structured_from_documents":
            kpi["confidence"] = kpi.get("confidence") if kpi.get("confidence") in {"low", "medium", "high"} else "low"
        valid_kpis.append(kpi)
    profiled["kpis"] = valid_kpis

    valid_charts = []
    for chart in profiled.get("charts", []):
        if not isinstance(chart, dict):
            continue
        data = [point for point in _as_list(chart.get("data")) if isinstance(point, dict)]
        if not data:
            warnings.append(f"No se incluyo el grafico {chart.get('title') or chart.get('chart_id')} porque no tiene datos reales.")
            missing_information.append(f"Faltan datos numericos para graficar {chart.get('title') or 'un grafico sugerido'}.")
            continue
        if not _as_list(chart.get("legend")):
            chart["legend"] = [
                {"label": str(point.get("label") or "Sin etiqueta"), "value": str(point.get("value") or 0), "color": None}
                for point in data[:12]
            ]
        valid_charts.append(chart)
    profiled["charts"] = valid_charts

    valid_tables = []
    for table in profiled.get("tables", []):
        if not isinstance(table, dict):
            continue
        if not _as_list(table.get("rows")):
            warnings.append(f"No se incluyo la tabla {table.get('title')} porque no tiene filas reales.")
            continue
        valid_tables.append(table)
    profiled["tables"] = valid_tables
    return warnings


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
    validate_dashboard_request(title, objective, files, settings.max_files_dashboard)

    temp_paths: list[Path] = []
    try:
        for upload in files:
            validate_allowed_file(upload.filename or "")
            temp_paths.append(await save_upload_temporarily(upload, settings.max_file_size_mb))

        user_context = {
            "dashboard_name": title,
            "audience": audience,
            "objective_instructions": objective,
            "period": period,
            "data_type": data_type,
            "additional_context": additional_context,
            "visualization_focus": visualization_focus or "Automático",
            "uploaded_files": [upload.filename or path.name for path, upload in zip(temp_paths, files)],
        }
        profiled = profile_files([(path, upload.filename or path.name) for path, upload in zip(temp_paths, files)], user_context=user_context)
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
        dashboard_plan: dict[str, Any] | None = None
        findings: list[dict[str, Any]] = []
        llm_used = False

        if not profiled["profile"]["numeric_columns"]:
            missing_information.append("No se detectaron columnas numericas claras para KPIs financieros.")
        if not profiled["profile"]["date_columns"]:
            missing_information.append("No se detecto una columna de fecha o periodo para tendencias.")

        has_document_sources = any(item.get("detected_type") not in {"xlsx", "csv"} for item in profiled.get("source_files", []))
        has_low_structure = profiled.get("data_understanding", {}).get("structure_level") in {"low", "medium"}
        has_user_instructions = any(str(user_context.get(key) or "").strip() for key in ("objective_instructions", "additional_context", "period", "data_type", "visualization_focus", "audience"))
        should_use_llm = use_llm_insights or has_document_sources or has_low_structure or has_user_instructions

        if should_use_llm:
            try:
                planner_result = await generate_agent_response(
                    agentType="dashboard_creator_planner",
                    systemPrompt=SYSTEM_PROMPT,
                    userPrompt=build_planner_prompt(
                        title=title,
                        objective=objective,
                        audience=audience,
                        period=period,
                        data_type=data_type,
                        visualization_focus=visualization_focus,
                        additional_context=additional_context,
                        profiled=profiled,
                    ),
                    documentPayload=profiled.get("document_summaries"),
                    outputContract={"required": ["dashboard_plan"]},
                )
                dashboard_plan = _normalize_dashboard_plan(planner_result.get("dashboard_plan"))
                dashboard_plan, plan_warnings = _validate_dashboard_plan(profiled, dashboard_plan)
                if plan_warnings:
                    profiled["profile"]["data_quality_warnings"] = _merge_unique(profiled["profile"].get("data_quality_warnings", []), plan_warnings)
                    observations = _merge_unique(
                        observations,
                        [{"title": "Validacion de dashboardPlan", "description": warning, "type": "data_quality"} for warning in plan_warnings],
                    )

                llm_result = await generate_agent_response(
                    agentType="dashboard_creator_insights",
                    systemPrompt=SYSTEM_PROMPT,
                    userPrompt=build_insight_prompt(
                        title=title,
                        objective=objective,
                        audience=audience,
                        period=period,
                        data_type=data_type,
                        visualization_focus=visualization_focus,
                        additional_context=additional_context,
                        profiled=profiled,
                    ),
                    documentPayload=profiled.get("document_summaries"),
                    outputContract={
                        "required": [
                            "executive_summary",
                            "kpis",
                            "charts",
                            "tables",
                            "insights",
                            "recommendations",
                            "missing_information",
                        ],
                        "quality": [
                            "executiveSummary",
                            "findings",
                            "risks",
                            "missingCriticalData",
                            "evidenceReferences",
                            "downloadReadiness",
                            "qualityWarnings",
                        ],
                    },
                )
                llm_result.pop("_usage", None)
                llm_result.pop("_model", None)
                llm_result.pop("_warnings", None)
                executive_summary = str(llm_result.get("executive_summary") or executive_summary)
                if not dashboard_plan:
                    dashboard_plan = _normalize_dashboard_plan(llm_result.get("dashboard_plan"))
                    dashboard_plan, plan_warnings = _validate_dashboard_plan(profiled, dashboard_plan)
                    if plan_warnings:
                        profiled["profile"]["data_quality_warnings"] = _merge_unique(profiled["profile"].get("data_quality_warnings", []), plan_warnings)
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
                allow_document_structuring = has_document_sources or profiled.get("data_understanding", {}).get("structure_level") == "low"
                if allow_document_structuring:
                    profiled["kpis"] = _merge_dashboard_items(profiled.get("kpis", []), llm_kpis, "title", 24)
                    profiled["charts"] = _merge_dashboard_items(profiled.get("charts", []), llm_charts, "chart_id", 16)
                    profiled["tables"] = _merge_dashboard_items(profiled.get("tables", []), llm_tables, "title", 12)

                if isinstance(llm_result.get("insights"), list):
                    insights = _merge_unique(insights, _normalize_insights(llm_result["insights"]))
                observations = _merge_unique(observations, _normalize_observations(_as_list(llm_result.get("observations"))))
                if isinstance(llm_result.get("recommendations"), list):
                    recommendations = _merge_unique(recommendations, [str(item) for item in llm_result["recommendations"]])
                if isinstance(llm_result.get("missing_information"), list):
                    missing_information = _merge_unique(missing_information, [str(item) for item in llm_result["missing_information"]])
                if isinstance(llm_result.get("findings"), list):
                    findings = _merge_unique(findings, _normalize_findings(llm_result["findings"]))
                if dashboard_plan:
                    recommendations = _merge_unique(recommendations, [str(item) for item in dashboard_plan.get("allowed_recommendations", [])])
                    missing_information = _merge_unique(missing_information, [str(item) for item in dashboard_plan.get("limitations", [])])
                    findings = _merge_unique(findings, _normalize_findings(_as_list(dashboard_plan.get("allowed_findings"))))

                chart_explanations = llm_result.get("chart_explanations")
                if isinstance(chart_explanations, dict):
                    for chart in profiled.get("charts", []):
                        explanation = chart_explanations.get(chart.get("chart_id"))
                        if explanation:
                            chart["insight"] = str(explanation)
                llm_used = True
            except HTTPException:
                recommendations.append("El analisis se genero con los datos estructurados disponibles; puede ampliarse si se cargan documentos mas completos.")

        anti_invention_warnings = _validate_dashboard_outputs(profiled, missing_information)
        if anti_invention_warnings:
            profiled["profile"]["data_quality_warnings"] = _merge_unique(
                profiled["profile"].get("data_quality_warnings", []),
                anti_invention_warnings,
            )
            observations = _merge_unique(
                observations,
                [{"title": "Datos insuficientes para algunos indicadores", "description": warning, "type": "data_quality"} for warning in anti_invention_warnings],
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
            observations=observations,
            recommendations=recommendations,
            missing_information=missing_information,
            dashboard_plan=dashboard_plan,
            findings=findings,
            missing_data_items=_missing_data_items(profiled, missing_information, dashboard_plan),
            llm_used=llm_used,
            model_provider="anthropic" if llm_used else None,
            model_name=settings.anthropic_model if llm_used else None,
            latency_ms=int((time.perf_counter() - started_at) * 1000),
        )
        result = validate_dashboard_result_payload(result)
        dashboard_result = DashboardResult.model_validate(result)
        publish_dashboard_completed_event(_dashboard_completed_payload(dashboard_result, len(files)))
        return dashboard_result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="No se pudo generar el dashboard.") from exc
    finally:
        if settings.delete_temp_files:
            cleanup_files(temp_paths)
