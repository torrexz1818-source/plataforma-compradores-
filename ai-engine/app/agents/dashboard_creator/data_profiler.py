from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from app.agents.dashboard_creator.chart_recommender import recommend_chart_type
from app.document_processing.document_reader import read_document_text
from app.document_processing.file_detector import detect_file_type

AMOUNT_HINTS = ("monto", "importe", "total", "precio", "costo", "gasto", "valor", "amount", "price", "cost")
SUPPLIER_HINTS = ("proveedor", "supplier", "vendor", "empresa", "razon", "razón")
CATEGORY_HINTS = ("categoria", "categoría", "category", "rubro", "familia", "tipo")
DATE_HINTS = ("fecha", "date", "periodo", "mes", "month", "year", "año")
QUANTITY_HINTS = ("cantidad", "qty", "quantity", "unidades")


def _read_table(path: Path, file_type: str) -> pd.DataFrame | None:
    if file_type == "csv":
        try:
            return pd.read_csv(path)
        except UnicodeDecodeError:
            return pd.read_csv(path, encoding="latin-1")
    if file_type == "xlsx":
        workbook = pd.read_excel(path, sheet_name=None)
        frames = []
        for sheet_name, frame in workbook.items():
            if frame.empty:
                continue
            frame = frame.copy()
            frame["__sheet"] = sheet_name
            frames.append(frame)
        return pd.concat(frames, ignore_index=True) if frames else None
    return None


def _clean_frame(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.dropna(how="all").dropna(axis=1, how="all")
    frame.columns = [str(column).strip() for column in frame.columns]
    return frame


def _to_numeric(series: pd.Series) -> pd.Series:
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce")
    cleaned = series.astype(str).str.replace(r"[^\d,.\-]", "", regex=True)
    cleaned = cleaned.str.replace(",", ".", regex=False)
    return pd.to_numeric(cleaned, errors="coerce")


def _detect_columns(frame: pd.DataFrame) -> tuple[list[str], list[str], list[str]]:
    numeric_columns: list[str] = []
    date_columns: list[str] = []
    category_columns: list[str] = []

    for column in frame.columns:
        values = frame[column].dropna()
        if values.empty:
            continue
        lower = column.lower()
        numeric = _to_numeric(values)
        numeric_ratio = numeric.notna().mean()
        parsed_dates = pd.to_datetime(values, errors="coerce", dayfirst=True)
        date_ratio = parsed_dates.notna().mean()

        if numeric_ratio >= 0.65 or any(hint in lower for hint in AMOUNT_HINTS + QUANTITY_HINTS):
            numeric_columns.append(column)
        elif date_ratio >= 0.55 or any(hint in lower for hint in DATE_HINTS):
            date_columns.append(column)
        elif values.nunique(dropna=True) <= max(30, len(values) * 0.7):
            category_columns.append(column)

    return numeric_columns, date_columns, category_columns


def _best_column(columns: list[str], hints: tuple[str, ...]) -> str | None:
    for column in columns:
        if any(hint in column.lower() for hint in hints):
            return column
    return columns[0] if columns else None


def _top_group(frame: pd.DataFrame, category: str, amount: str, limit: int = 10) -> list[dict[str, Any]]:
    values = frame[[category, amount]].copy()
    values[amount] = _to_numeric(values[amount])
    grouped = values.dropna(subset=[category, amount]).groupby(category)[amount].sum().sort_values(ascending=False).head(limit)
    return [{"label": str(label), "value": float(value)} for label, value in grouped.items()]


def _monthly_trend(frame: pd.DataFrame, date_col: str, amount_col: str) -> list[dict[str, Any]]:
    values = frame[[date_col, amount_col]].copy()
    values[date_col] = pd.to_datetime(values[date_col], errors="coerce", dayfirst=True)
    values[amount_col] = _to_numeric(values[amount_col])
    values = values.dropna(subset=[date_col, amount_col])
    if values.empty:
        return []
    values["period"] = values[date_col].dt.to_period("M").astype(str)
    grouped = values.groupby("period")[amount_col].sum().sort_index().tail(12)
    return [{"label": str(label), "value": float(value)} for label, value in grouped.items()]


def profile_files(files: list[tuple[Path, str]]) -> dict[str, Any]:
    frames: list[pd.DataFrame] = []
    document_summaries: list[dict[str, Any]] = []
    warnings: list[str] = []
    detected_columns: list[str] = []
    numeric_columns: list[str] = []
    date_columns: list[str] = []
    category_columns: list[str] = []

    for path, filename in files:
        file_type = detect_file_type(filename)
        if file_type in {"xlsx", "csv"}:
            frame = _read_table(path, file_type)
            if frame is None or frame.empty:
                warnings.append(f"{filename}: no se detectaron filas tabulares.")
                continue
            frame = _clean_frame(frame)
            frame["__source_file"] = filename
            frames.append(frame)
            detected_columns.extend([column for column in frame.columns if not column.startswith("__")])
            n_cols, d_cols, c_cols = _detect_columns(frame)
            numeric_columns.extend(n_cols)
            date_columns.extend(d_cols)
            category_columns.extend(c_cols)
        else:
            text, detected_type, file_warnings = read_document_text(path, filename)
            compact = text[:2500]
            document_summaries.append(
                {
                    "file_name": filename,
                    "detected_type": detected_type,
                    "text_preview": compact,
                    "limitations": file_warnings + ["Fuente secundaria: se usó texto extraído, no dataset tabular completo."],
                }
            )
            warnings.extend(file_warnings)

    combined = pd.concat(frames, ignore_index=True, sort=False) if frames else pd.DataFrame()
    total_rows = int(len(combined))
    detected_columns = sorted(set(detected_columns))
    numeric_columns = sorted(set(numeric_columns))
    date_columns = sorted(set(date_columns))
    category_columns = sorted(set(category_columns))

    if combined.empty:
        warnings.append("No se detectaron datos tabulares suficientes; el dashboard se basará en texto extraído si existe.")

    amount_col = _best_column(numeric_columns, AMOUNT_HINTS) if not combined.empty else None
    supplier_col = _best_column(category_columns, SUPPLIER_HINTS) if not combined.empty else None
    category_col = _best_column(category_columns, CATEGORY_HINTS) if not combined.empty else None
    date_col = _best_column(date_columns, DATE_HINTS) if not combined.empty else None

    kpis: list[dict[str, Any]] = []
    charts: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    insights: list[dict[str, Any]] = []

    if total_rows:
        kpis.append({"title": "Filas analizadas", "value": f"{total_rows:,}", "description": "Registros detectados en archivos tabulares.", "calculation_logic": "Conteo de filas válidas.", "confidence": "high"})

    if amount_col:
        amount_values = _to_numeric(combined[amount_col])
        total_amount = float(amount_values.sum(skipna=True))
        avg_amount = float(amount_values.mean(skipna=True)) if amount_values.notna().any() else 0
        kpis.append({"title": "Monto total", "value": f"{total_amount:,.2f}", "description": f"Suma de la columna {amount_col}.", "calculation_logic": f"SUM({amount_col})", "confidence": "high"})
        kpis.append({"title": "Ticket promedio", "value": f"{avg_amount:,.2f}", "description": f"Promedio de la columna {amount_col}.", "calculation_logic": f"AVG({amount_col})", "confidence": "high"})

    if supplier_col:
        supplier_count = int(combined[supplier_col].dropna().astype(str).nunique())
        kpis.append({"title": "Proveedores detectados", "value": str(supplier_count), "description": f"Valores únicos en {supplier_col}.", "calculation_logic": f"COUNT DISTINCT({supplier_col})", "confidence": "medium"})

    if supplier_col and amount_col:
        top_suppliers = _top_group(combined, supplier_col, amount_col)
        top_supplier_chart_type = recommend_chart_type(has_date=False, has_category=True, has_amount=True, item_count=len(top_suppliers))
        charts.append({"chart_id": "top_suppliers", "title": "Top proveedores por monto", "type": top_supplier_chart_type, "description": "Ranking de proveedores con mayor monto.", "x_axis": supplier_col, "y_axis": amount_col, "data": top_suppliers, "insight": "Permite detectar concentración de gasto por proveedor."})
        tables.append({"title": "Resumen por proveedor", "description": "Top proveedores por monto acumulado.", "columns": ["Proveedor", "Monto"], "rows": [{"Proveedor": item["label"], "Monto": item["value"]} for item in top_suppliers]})
        if top_suppliers and sum(item["value"] for item in top_suppliers) > 0:
            concentration = top_suppliers[0]["value"] / sum(item["value"] for item in top_suppliers)
            if concentration >= 0.5:
                insights.append({"title": "Alta concentración de gasto", "description": f"{top_suppliers[0]['label']} concentra aproximadamente {concentration:.0%} del top analizado.", "impact": "high", "recommended_action": "Revisar dependencia del proveedor y alternativas de negociación."})

    if category_col and amount_col:
        top_categories = _top_group(combined, category_col, amount_col)
        charts.append({"chart_id": "top_categories", "title": "Monto por categoría", "type": "bar", "description": "Distribución de monto por categoría.", "x_axis": category_col, "y_axis": amount_col, "data": top_categories, "insight": "Ayuda a priorizar categorías de mayor impacto."})

    if date_col and amount_col:
        trend = _monthly_trend(combined, date_col, amount_col)
        if trend:
            charts.append({"chart_id": "monthly_trend", "title": "Evolución mensual", "type": "line", "description": "Tendencia del monto por periodo.", "x_axis": date_col, "y_axis": amount_col, "data": trend, "insight": "Muestra variaciones temporales y posibles picos de gasto."})

    if not charts and amount_col:
        amount_values = _to_numeric(combined[amount_col]).dropna().sort_values(ascending=False).head(10)
        charts.append({"chart_id": "top_values", "title": f"Top valores de {amount_col}", "type": "bar", "description": "Valores principales detectados.", "x_axis": "Registro", "y_axis": amount_col, "data": [{"label": f"Registro {index + 1}", "value": float(value)} for index, value in enumerate(amount_values)], "insight": "Vista básica de los mayores valores detectados."})

    null_counts = combined.isna().sum().sort_values(ascending=False) if not combined.empty else pd.Series(dtype="int64")
    missing = [f"{column}: {int(count)} valores vacíos" for column, count in null_counts.head(8).items() if count > 0]
    warnings.extend(missing)

    profile = {
        "files_processed": len(files),
        "rows_detected": total_rows,
        "columns_detected": len(detected_columns),
        "detected_columns": detected_columns[:80],
        "date_columns": date_columns,
        "numeric_columns": numeric_columns,
        "category_columns": category_columns,
        "data_quality_warnings": warnings[:20],
    }

    return {
        "profile": profile,
        "kpis": kpis,
        "charts": charts,
        "tables": tables,
        "insights": insights,
        "document_summaries": document_summaries,
        "suggested_filters": [column for column in [date_col, supplier_col, category_col] if column],
    }
