from __future__ import annotations

from fastapi import HTTPException, UploadFile

ALLOWED_KPI_SOURCES = {"python", "backend", "calculated", "llm_structured_from_documents"}
ALLOWED_CHART_TYPES = {"bar", "horizontal_bar", "line", "area", "pie", "donut", "stacked_bar", "table", "kpi", "matrix", "alert"}


def validate_dashboard_request(title: str, objective: str, files: list[UploadFile]) -> None:
    if not title.strip():
        raise HTTPException(status_code=400, detail="El nombre del dashboard es obligatorio.")
    if not objective.strip():
        raise HTTPException(status_code=400, detail="El objetivo del dashboard es obligatorio.")
    if not files:
        raise HTTPException(status_code=400, detail="Sube al menos un archivo de datos para crear el dashboard.")
    if len(files) > 8:
        raise HTTPException(status_code=400, detail="Puedes subir como maximo 8 archivos para crear el dashboard.")


def _as_list(value):
    return value if isinstance(value, list) else []


def _as_dict(value):
    return value if isinstance(value, dict) else {}


def _missing_item(indicator: str, reason: str, required_fields: list[str] | None = None) -> dict:
    return {"indicator": indicator, "reason": reason, "required_fields": required_fields or []}


def validate_dashboard_result_payload(result: dict) -> dict:
    profile = _as_dict(result.get("dataProfile") or result.get("data_profile"))
    candidates = _as_dict(profile.get("candidateFields"))
    quality_warnings = list(_as_list(result.get("qualityWarnings")))
    missing_data = list(_as_list(result.get("missingData")))

    valid_kpis = []
    for kpi in _as_list(result.get("kpis")):
        if not isinstance(kpi, dict):
            continue
        if not kpi.get("title") or kpi.get("value") in {None, ""}:
            quality_warnings.append("Se retiro un KPI sin titulo o valor real.")
            continue
        if kpi.get("source") not in ALLOWED_KPI_SOURCES:
            kpi["source"] = "calculated"
        valid_kpis.append(kpi)
    result["kpis"] = valid_kpis

    valid_charts = []
    for chart in _as_list(result.get("charts")):
        if not isinstance(chart, dict):
            continue
        if chart.get("type") not in ALLOWED_CHART_TYPES:
            chart["type"] = "bar"
        if not chart.get("title") or not _as_list(chart.get("data")):
            quality_warnings.append(f"Se retiro un grafico sin datos reales: {chart.get('title') or chart.get('chart_id') or 'sin titulo'}.")
            continue
        if not _as_list(chart.get("legend")):
            chart["legend"] = [
                {"label": str(point.get("label") or "Sin etiqueta"), "value": str(point.get("value") or 0), "color": None}
                for point in _as_list(chart.get("data"))
                if isinstance(point, dict)
            ]
        valid_charts.append(chart)
    result["charts"] = valid_charts

    valid_tables = []
    for table in _as_list(result.get("tables")):
        if not isinstance(table, dict):
            continue
        if not _as_list(table.get("columns")) or not _as_list(table.get("rows")):
            quality_warnings.append(f"Se retiro una tabla sin columnas o filas reales: {table.get('title') or 'sin titulo'}.")
            continue
        valid_tables.append(table)
    result["tables"] = valid_tables

    protected_requirements = [
        ("Kraljic", [["impacto_financiero"], ["riesgo_suministro"]], "No se calcula Kraljic sin impacto financiero y riesgo de suministro."),
        ("OTIF", [["fecha_prometida"], ["fecha_real"], ["cantidad_solicitada"], ["cantidad_entregada"]], "No se calcula OTIF sin fechas prometida/real y cantidades solicitada/entregada."),
        ("NPS", [["nps"]], "No se calcula NPS sin una escala NPS explicita."),
        ("Ahorro", [["ahorro", "precio_base"], ["ahorro", "precio_negociado"]], "No se calcula ahorro sin precio comparativo y precio negociado, o una columna de ahorro declarada."),
        ("Ciclo de compra", [["fecha"], ["fecha_real"]], "No se calculan ciclos sin fechas comparables."),
        ("Condiciones de pago", [["condicion_pago"]], "No se analizan condiciones de pago sin plazo/condicion/fecha de pago."),
    ]
    text_blob = " ".join(
        [str(item.get("title", "")) for item in result["kpis"]]
        + [str(item.get("title", "")) for item in result["charts"]]
        + [str(item.get("title", "")) for item in result["tables"]]
    ).lower()
    for indicator, required_groups, reason in protected_requirements:
        if indicator.lower() not in text_blob:
            continue
        missing = ["/".join(group) for group in required_groups if not any(field in candidates for field in group)]
        if missing:
            quality_warnings.append(reason)
            missing_data.append(_missing_item(indicator, reason, missing))

    valid_findings = []
    for finding in _as_list(result.get("findings")):
        if not isinstance(finding, dict):
            continue
        if not finding.get("evidence") and not finding.get("source_component") and not finding.get("inferred"):
            finding["inferred"] = True
            finding["confidence"] = "low"
            quality_warnings.append(f"Hallazgo marcado como inferencia por falta de evidencia directa: {finding.get('title') or 'sin titulo'}.")
        valid_findings.append(finding)
    result["findings"] = valid_findings

    result["missingData"] = [
        item if isinstance(item, dict) and item.get("indicator") and item.get("reason") else _missing_item("Informacion faltante", str(item), [])
        for item in missing_data
    ]
    result["qualityWarnings"] = list(dict.fromkeys(str(item) for item in quality_warnings if item))
    if isinstance(result.get("data_profile"), dict):
        result["data_profile"]["data_quality_warnings"] = list(dict.fromkeys(_as_list(result["data_profile"].get("data_quality_warnings")) + result["qualityWarnings"]))
    if isinstance(result.get("dataProfile"), dict):
        result["dataProfile"]["data_quality_warnings"] = result.get("data_profile", result["dataProfile"]).get("data_quality_warnings", result["qualityWarnings"])
    return result
