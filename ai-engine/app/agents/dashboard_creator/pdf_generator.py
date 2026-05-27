from __future__ import annotations

from typing import Any

from app.utils.agent_result_pdf import build_platform_result_pdf

TECHNICAL_KEYS = {
    "dataProfile",
    "dashboardPlan",
    "data_profile",
    "metadata",
    "confidence_level",
    "confidence_reason",
    "analysis_type",
    "data_understanding",
    "visualConfig",
    "layout_suggestion",
    "suggested_filters",
    "document_summaries",
    "qualityWarnings",
    "observations",
    "missingData",
    "missing_information",
    "source_files",
    "objective",
    "analysis_mode",
    "data_understanding",
    "visualConfig",
    "suggested_filters",
    "layout_suggestion",
    "disclaimer",
}

DASHBOARD_CREATOR_DISCLAIMER = (
    "Este dashboard de compras fue generado con asistencia de IA a partir de los archivos cargados por el usuario. "
    "La información, indicadores y recomendaciones deben ser revisados y validados por el comprador antes de tomar decisiones finales."
)


EMPTY_EXECUTIVE_VALUES = {"", "nan", "null", "undefined", "none", "n/a", "na"}
AMOUNT_COLUMN_TOKENS = ("monto", "total", "importe", "valor", "subtotal", "saldo", "precio", "ahorro", "gasto", "cantidad", "%", "porcentaje")


def _is_empty_executive_value(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and value != value:
        return True
    return str(value).strip().lower() in EMPTY_EXECUTIVE_VALUES


def _has_numeric_value(value: Any) -> bool:
    if _is_empty_executive_value(value):
        return False
    if isinstance(value, (int, float)):
        return value == value and value != 0
    try:
        numeric = float("".join(ch for ch in str(value) if ch.isdigit() or ch in ".-"))
        return numeric != 0
    except ValueError:
        return False


def _sanitize_table(item: dict[str, Any]) -> dict[str, Any]:
    columns = [str(column).strip() for column in item.get("columns") or [] if str(column).strip()]
    title = str(item.get("title") or "").strip()
    proveedor_column = next((column for column in columns if "proveedor" in column.lower()), None)
    categoria_column = next((column for column in columns if "categor" in column.lower()), None)
    monto_column = next((column for column in columns if any(token in column.lower() for token in AMOUNT_COLUMN_TOKENS)), None)
    requires_provider_category = (
        "matriz" in title.lower()
        and "concentraci" in title.lower()
        and "proveedor" in title.lower()
        and "categor" in title.lower()
    ) or bool(proveedor_column and categoria_column and monto_column)

    cleaned_rows: list[dict[str, Any]] = []
    for row in item.get("rows") or []:
        if not isinstance(row, dict):
            continue
        cleaned = {column: ("" if _is_empty_executive_value(row.get(column)) else row.get(column)) for column in columns}
        if requires_provider_category:
            if not (
                proveedor_column
                and categoria_column
                and monto_column
                and not _is_empty_executive_value(cleaned.get(proveedor_column))
                and not _is_empty_executive_value(cleaned.get(categoria_column))
                and _has_numeric_value(cleaned.get(monto_column))
            ):
                continue
        else:
            dimension_columns = [column for column in columns if not any(token in column.lower() for token in AMOUNT_COLUMN_TOKENS)]
            has_any_value = any(not _is_empty_executive_value(cleaned.get(column)) for column in columns)
            has_dimension = any(not _is_empty_executive_value(cleaned.get(column)) for column in dimension_columns)
            if not has_any_value or (dimension_columns and not has_dimension):
                continue
        cleaned_rows.append(cleaned)

    return {
        "title": title,
        "description": item.get("description"),
        "columns": columns,
        "rows": cleaned_rows,
    }


def _executive_result(result: dict[str, Any]) -> dict[str, Any]:
    cleaned = {key: value for key, value in result.items() if key not in TECHNICAL_KEYS}
    summary = cleaned.get("executiveSummary")
    if isinstance(summary, dict):
        summary = dict(summary)
        summary["analysis_built"] = "Reporte ejecutivo generado a partir de los archivos cargados, con indicadores calculados segun la informacion disponible."
        cleaned["executiveSummary"] = summary
    cleaned["kpis"] = [
        {key: value for key, value in item.items() if key not in {"source", "calculation_logic", "confidence", "status"}}
        for item in result.get("kpis", [])
        if isinstance(item, dict) and item.get("title") not in {"Registros analizados", "Columnas detectadas"}
    ]
    cleaned["charts"] = [
        {
            "chart_id": item.get("chart_id"),
            "title": item.get("title"),
            "type": item.get("type"),
            "description": item.get("description"),
            "x_axis": item.get("x_axis"),
            "y_axis": item.get("y_axis"),
            "data": item.get("data"),
            "colors": item.get("colors"),
            "legend": item.get("legend"),
            "insight": item.get("insight"),
        }
        for item in result.get("charts", [])
        if isinstance(item, dict) and item.get("data")
    ][:8]
    cleaned["tables"] = [
        table
        for table in (_sanitize_table(item) for item in result.get("tables", []) if isinstance(item, dict))
        if table["columns"]
        and table["rows"]
        and not any(token in table["title"].lower() for token in ("documentos procesados", "archivos procesados", "calidad", "data profile", "datos faltantes"))
    ][:4]
    cleaned["findings"] = [
        {"title": item.get("title"), "description": item.get("description")}
        for item in result.get("findings", [])
        if isinstance(item, dict) and item.get("title") and item.get("description")
    ][:8]
    cleaned["recommendations"] = [item for item in result.get("recommendations", []) if item][:8]
    cleaned["disclaimer"] = DASHBOARD_CREATOR_DISCLAIMER
    return cleaned


def build_dashboard_pdf(result: dict[str, Any], branding: dict[str, Any] | None = None) -> bytes:
    """Legacy-compatible PDF path.

    The frontend export flow uses src/lib/agentPdf.ts as the official path.
    This backend endpoint only converts the provided DashboardResult and must
    not recalculate metrics or call the LLM.
    """
    return build_platform_result_pdf(_executive_result(result), "Creador de Dashboard", branding, "Creador de Dashboard")
