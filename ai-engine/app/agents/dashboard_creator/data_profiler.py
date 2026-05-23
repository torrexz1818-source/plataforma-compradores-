from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from app.agents.dashboard_creator.chart_recommender import recommend_chart_type
from app.document_processing.document_reader import read_document_text
from app.document_processing.file_detector import detect_file_type

AMOUNT_HINTS = ("monto", "importe", "total", "precio", "costo", "gasto", "valor", "amount", "price", "cost")
SUPPLIER_HINTS = ("proveedor", "supplier", "vendor", "empresa", "razon", "cliente")
CATEGORY_HINTS = ("categoria", "category", "rubro", "familia", "tipo", "linea", "producto", "servicio")
DATE_HINTS = ("fecha", "date", "periodo", "mes", "month", "year", "ano")
QUANTITY_HINTS = ("cantidad", "qty", "quantity", "unidades", "items")
STATUS_HINTS = ("estado", "status", "situacion")
TEXT_KEYWORDS = (
    "proveedor",
    "precio",
    "monto",
    "total",
    "garantia",
    "plazo",
    "categoria",
    "condiciones",
    "factura",
    "cotizacion",
    "contrato",
)


def _read_table(path: Path, file_type: str) -> pd.DataFrame | None:
    if file_type == "csv":
        try:
            return pd.read_csv(path, sep=None, engine="python")
        except UnicodeDecodeError:
            return pd.read_csv(path, sep=None, engine="python", encoding="latin-1")
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

    def normalize(value: Any) -> str:
        text = str(value).strip()
        if not text or text.lower() in {"nan", "none", "null"}:
            return ""
        text = "".join(char for char in text if char.isdigit() or char in ",.-")
        if "," in text and "." in text:
            if text.rfind(",") > text.rfind("."):
                text = text.replace(".", "").replace(",", ".")
            else:
                text = text.replace(",", "")
        elif "," in text:
            parts = text.split(",")
            text = text.replace(",", "") if len(parts[-1]) == 3 else text.replace(",", ".")
        elif text.count(".") > 1:
            text = text.replace(".", "")
        return text

    return pd.to_numeric(series.map(normalize), errors="coerce")


def _detect_columns(frame: pd.DataFrame) -> tuple[list[str], list[str], list[str]]:
    numeric_columns: list[str] = []
    date_columns: list[str] = []
    category_columns: list[str] = []

    for column in frame.columns:
        if column.startswith("__"):
            continue
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
        elif values.nunique(dropna=True) <= max(35, len(values) * 0.72):
            category_columns.append(column)

    return numeric_columns, date_columns, category_columns


def _best_column(columns: list[str], hints: tuple[str, ...]) -> str | None:
    for column in columns:
        lower = column.lower()
        if any(hint in lower for hint in hints):
            return column
    return columns[0] if columns else None


def _hint_column(columns: list[str], hints: tuple[str, ...]) -> str | None:
    for column in columns:
        lower = column.lower()
        if any(hint in lower for hint in hints):
            return column
    return None


def _format_number(value: float | int | None) -> str:
    if value is None or pd.isna(value):
        return "0"
    return f"{float(value):,.2f}"


def _top_group(frame: pd.DataFrame, category: str, amount: str, limit: int = 10) -> list[dict[str, Any]]:
    values = frame[[category, amount]].copy()
    values[category] = values[category].astype(str).str.strip()
    values[amount] = _to_numeric(values[amount])
    values = values.dropna(subset=[category, amount])
    values = values[values[category].str.lower().ne("nan")]
    if values.empty:
        return []
    grouped = values.groupby(category)[amount].sum().sort_values(ascending=False).head(limit)
    return [{"label": str(label), "value": round(float(value), 2)} for label, value in grouped.items()]


def _monthly_trend(frame: pd.DataFrame, date_col: str, amount_col: str) -> list[dict[str, Any]]:
    values = frame[[date_col, amount_col]].copy()
    values[date_col] = pd.to_datetime(values[date_col], errors="coerce", dayfirst=True)
    values[amount_col] = _to_numeric(values[amount_col])
    values = values.dropna(subset=[date_col, amount_col])
    if values.empty:
        return []
    values["period"] = values[date_col].dt.to_period("M").astype(str)
    grouped = values.groupby("period")[amount_col].sum().sort_index().tail(12)
    return [{"label": str(label), "value": round(float(value), 2)} for label, value in grouped.items()]


def _summary_table(items: list[dict[str, Any]], label: str, value_label: str) -> list[dict[str, Any]]:
    total = sum(float(item.get("value") or 0) for item in items)
    rows = []
    for index, item in enumerate(items, start=1):
        value = float(item.get("value") or 0)
        rows.append(
            {
                "Ranking": index,
                label: item.get("label"),
                value_label: _format_number(value),
                "Participacion": f"{(value / total):.1%}" if total else "0%",
            }
        )
    return rows


def _text_relevance(text: str) -> list[str]:
    lowered = text.lower()
    findings = [keyword for keyword in TEXT_KEYWORDS if keyword in lowered]
    return findings[:8]


def _build_document_only_outputs(document_summaries: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    if not document_summaries:
        return [], [], []

    kpis = [
        {
            "title": "Documentos leidos",
            "value": str(len(document_summaries)),
            "description": "Archivos no tabulares procesados con MarkItDown/fallback documental.",
            "calculation_logic": "Conteo de documentos procesados.",
            "confidence": "medium",
        }
    ]
    rows = []
    for doc in document_summaries:
        rows.append(
            {
                "Archivo": doc["file_name"],
                "Tipo": doc["detected_type"],
                "Datos detectados": ", ".join(doc.get("relevant_findings", [])) or "Texto general",
                "Limitaciones": "; ".join(doc.get("limitations", [])[:2]),
            }
        )
    tables = [
        {
            "title": "Resumen de documentos procesados",
            "description": "Fuentes usadas como soporte cuando no hay Excel/CSV tabular suficiente.",
            "columns": ["Archivo", "Tipo", "Datos detectados", "Limitaciones"],
            "rows": rows,
        }
    ]
    insights = [
        {
            "title": "Dashboard basado en documentos",
            "description": "Se detectaron documentos de soporte, pero no una tabla estructurada suficiente para KPIs financieros avanzados.",
            "impact": "medium",
            "recommended_action": "Subir un Excel o CSV con columnas de fecha, proveedor/categoria y monto para obtener graficos cuantitativos.",
        }
    ]
    return kpis, tables, insights


def profile_files(files: list[tuple[Path, str]]) -> dict[str, Any]:
    frames: list[pd.DataFrame] = []
    document_summaries: list[dict[str, Any]] = []
    warnings: list[str] = []
    detected_columns: list[str] = []
    numeric_columns: list[str] = []
    date_columns: list[str] = []
    category_columns: list[str] = []
    source_files: list[dict[str, Any]] = []

    for path, filename in files:
        file_type = detect_file_type(filename)
        source_files.append({"file_name": filename, "detected_type": file_type})
        if file_type in {"xlsx", "csv"}:
            frame = _read_table(path, file_type)
            if frame is None or frame.empty:
                warnings.append(f"{filename}: no se detectaron filas tabulares.")
                continue
            frame = _clean_frame(frame)
            if frame.empty:
                warnings.append(f"{filename}: la tabla queda vacia despues de limpiar filas/columnas vacias.")
                continue
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
            findings = _text_relevance(compact)
            document_summaries.append(
                {
                    "file_name": filename,
                    "detected_type": detected_type,
                    "text_preview": None,
                    "relevant_findings": findings,
                    "limitations": file_warnings + ["Fuente secundaria: texto extraido, no dataset tabular completo."],
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
        warnings.append("No se detectaron datos tabulares suficientes; el dashboard se basara en texto extraido si existe.")

    amount_col = _best_column(numeric_columns, AMOUNT_HINTS) if not combined.empty else None
    quantity_col = _best_column(numeric_columns, QUANTITY_HINTS) if not combined.empty else None
    supplier_col = _best_column(category_columns, SUPPLIER_HINTS) if not combined.empty else None
    category_col = _best_column(category_columns, CATEGORY_HINTS) if not combined.empty else None
    date_col = _best_column(date_columns, DATE_HINTS) if not combined.empty else None
    status_col = _hint_column(category_columns, STATUS_HINTS) if not combined.empty else None

    kpis: list[dict[str, Any]] = []
    charts: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    insights: list[dict[str, Any]] = []

    if total_rows:
        kpis.append(
            {
                "title": "Registros analizados",
                "value": f"{total_rows:,}",
                "description": "Filas validas detectadas en archivos tabulares.",
                "calculation_logic": "Conteo de filas despues de limpiar filas vacias.",
                "confidence": "high",
            }
        )
        kpis.append(
            {
                "title": "Columnas detectadas",
                "value": str(len(detected_columns)),
                "description": "Campos disponibles para armar filtros, KPIs y graficos.",
                "calculation_logic": "Conteo de columnas no tecnicas.",
                "confidence": "high",
            }
        )

    if amount_col:
        amount_values = _to_numeric(combined[amount_col])
        valid_amounts = amount_values.dropna()
        total_amount = float(valid_amounts.sum()) if not valid_amounts.empty else 0.0
        avg_amount = float(valid_amounts.mean()) if not valid_amounts.empty else 0.0
        max_amount = float(valid_amounts.max()) if not valid_amounts.empty else 0.0
        kpis.extend(
            [
                {
                    "title": "Monto total",
                    "value": _format_number(total_amount),
                    "description": f"Suma de la columna {amount_col}.",
                    "calculation_logic": f"SUM({amount_col})",
                    "confidence": "high",
                },
                {
                    "title": "Ticket promedio",
                    "value": _format_number(avg_amount),
                    "description": f"Promedio de la columna {amount_col}.",
                    "calculation_logic": f"AVG({amount_col})",
                    "confidence": "high",
                },
                {
                    "title": "Mayor registro",
                    "value": _format_number(max_amount),
                    "description": f"Valor maximo detectado en {amount_col}.",
                    "calculation_logic": f"MAX({amount_col})",
                    "confidence": "high",
                },
            ]
        )

    if supplier_col:
        supplier_count = int(combined[supplier_col].dropna().astype(str).str.strip().nunique())
        kpis.append(
            {
                "title": "Proveedores detectados",
                "value": str(supplier_count),
                "description": f"Valores unicos en {supplier_col}.",
                "calculation_logic": f"COUNT DISTINCT({supplier_col})",
                "confidence": "medium",
            }
        )

    if category_col:
        category_count = int(combined[category_col].dropna().astype(str).str.strip().nunique())
        kpis.append(
            {
                "title": "Categorias detectadas",
                "value": str(category_count),
                "description": f"Valores unicos en {category_col}.",
                "calculation_logic": f"COUNT DISTINCT({category_col})",
                "confidence": "medium",
            }
        )

    if quantity_col:
        quantity_values = _to_numeric(combined[quantity_col]).dropna()
        if not quantity_values.empty:
            kpis.append(
                {
                    "title": "Cantidad total",
                    "value": _format_number(float(quantity_values.sum())),
                    "description": f"Suma de la columna {quantity_col}.",
                    "calculation_logic": f"SUM({quantity_col})",
                    "confidence": "medium",
                }
            )

    if date_col:
        parsed_dates = pd.to_datetime(combined[date_col], errors="coerce", dayfirst=True).dropna()
        if not parsed_dates.empty:
            kpis.append(
                {
                    "title": "Periodo detectado",
                    "value": f"{parsed_dates.min().date()} a {parsed_dates.max().date()}",
                    "description": f"Rango de fechas encontrado en {date_col}.",
                    "calculation_logic": f"MIN/MAX({date_col})",
                    "confidence": "medium",
                }
            )

    if supplier_col and amount_col:
        top_suppliers = _top_group(combined, supplier_col, amount_col)
        chart_type = recommend_chart_type(has_date=False, has_category=True, has_amount=True, item_count=len(top_suppliers))
        charts.append(
            {
                "chart_id": "top_suppliers",
                "title": "Top proveedores por monto",
                "type": chart_type,
                "description": "Ranking de proveedores con mayor monto acumulado.",
                "x_axis": supplier_col,
                "y_axis": amount_col,
                "data": top_suppliers,
                "insight": "Permite detectar concentracion de gasto y dependencia por proveedor.",
            }
        )
        tables.append(
            {
                "title": "Resumen por proveedor",
                "description": "Top proveedores por monto acumulado y participacion.",
                "columns": ["Ranking", "Proveedor", "Monto", "Participacion"],
                "rows": _summary_table(top_suppliers, "Proveedor", "Monto"),
            }
        )
        total_top = sum(item["value"] for item in top_suppliers)
        if top_suppliers and total_top > 0:
            concentration = float(top_suppliers[0]["value"]) / total_top
            kpis.append(
                {
                    "title": "Concentracion proveedor top",
                    "value": f"{concentration:.1%}",
                    "description": f"Participacion del proveedor {top_suppliers[0]['label']} dentro del top analizado.",
                    "calculation_logic": "Monto proveedor top / monto top proveedores.",
                    "confidence": "medium",
                }
            )
            if concentration >= 0.5:
                insights.append(
                    {
                        "title": "Alta concentracion de gasto",
                        "description": f"{top_suppliers[0]['label']} concentra aproximadamente {concentration:.1%} del top analizado.",
                        "impact": "high",
                        "recommended_action": "Revisar dependencia del proveedor y preparar alternativas o negociacion.",
                    }
                )

    if category_col and amount_col:
        top_categories = _top_group(combined, category_col, amount_col)
        charts.append(
            {
                "chart_id": "top_categories",
                "title": "Monto por categoria",
                "type": "horizontal_bar" if len(top_categories) > 6 else "bar",
                "description": "Distribucion de monto por categoria.",
                "x_axis": category_col,
                "y_axis": amount_col,
                "data": top_categories,
                "insight": "Ayuda a priorizar categorias de mayor impacto economico.",
            }
        )
        tables.append(
            {
                "title": "Resumen por categoria",
                "description": "Categorias con mayor monto acumulado.",
                "columns": ["Ranking", "Categoria", "Monto", "Participacion"],
                "rows": _summary_table(top_categories, "Categoria", "Monto"),
            }
        )

    if date_col and amount_col:
        trend = _monthly_trend(combined, date_col, amount_col)
        if trend:
            charts.append(
                {
                    "chart_id": "monthly_trend",
                    "title": "Evolucion mensual",
                    "type": "line",
                    "description": "Tendencia del monto por periodo.",
                    "x_axis": date_col,
                    "y_axis": amount_col,
                    "data": trend,
                    "insight": "Muestra variaciones temporales, picos y posibles estacionalidades.",
                }
            )
            rows = [{"Periodo": item["label"], "Monto": _format_number(item["value"])} for item in trend]
            tables.append(
                {
                    "title": "Evolucion por periodo",
                    "description": "Monto agrupado por mes detectado.",
                    "columns": ["Periodo", "Monto"],
                    "rows": rows,
                }
            )
            if len(trend) >= 2 and trend[-2]["value"]:
                variation = (trend[-1]["value"] - trend[-2]["value"]) / trend[-2]["value"]
                if abs(variation) >= 0.2:
                    insights.append(
                        {
                            "title": "Variacion mensual relevante",
                            "description": f"El ultimo periodo varia {variation:.1%} frente al periodo anterior.",
                            "impact": "high" if abs(variation) >= 0.35 else "medium",
                            "recommended_action": "Validar causa del cambio y separar efecto precio, volumen o proveedor.",
                        }
                    )

    if status_col and amount_col:
        top_status = _top_group(combined, status_col, amount_col, limit=8)
        if top_status:
            charts.append(
                {
                    "chart_id": "status_distribution",
                    "title": "Monto por estado",
                    "type": "donut",
                    "description": "Distribucion de monto segun estado detectado.",
                    "x_axis": status_col,
                    "y_axis": amount_col,
                    "data": top_status,
                    "insight": "Ayuda a revisar aprobaciones, pendientes o estados operativos.",
                }
            )

    if not charts and amount_col:
        amount_values = _to_numeric(combined[amount_col]).dropna().sort_values(ascending=False).head(10)
        charts.append(
            {
                "chart_id": "top_values",
                "title": f"Top valores de {amount_col}",
                "type": "bar",
                "description": "Valores principales detectados.",
                "x_axis": "Registro",
                "y_axis": amount_col,
                "data": [{"label": f"Registro {index + 1}", "value": round(float(value), 2)} for index, value in enumerate(amount_values)],
                "insight": "Vista basica de los mayores valores detectados.",
            }
        )

    document_kpis, document_tables, document_insights = _build_document_only_outputs(document_summaries)
    if document_summaries:
        kpis.extend(document_kpis)
        tables.extend(document_tables)
        insights.extend(document_insights if combined.empty else [])

    null_counts = combined.isna().sum().sort_values(ascending=False) if not combined.empty else pd.Series(dtype="int64")
    missing = [f"{column}: {int(count)} valores vacios" for column, count in null_counts.head(8).items() if count > 0 and not str(column).startswith("__")]
    warnings.extend(missing)

    if not amount_col and total_rows:
        warnings.append("No se detecto una columna clara de monto/costo/valor; los KPIs financieros pueden quedar limitados.")
    if not supplier_col and total_rows:
        warnings.append("No se detecto una columna clara de proveedor; no se puede armar ranking por proveedor.")
    if not category_col and total_rows:
        warnings.append("No se detecto una columna clara de categoria; no se puede armar resumen por categoria.")

    profile = {
        "files_processed": len(files),
        "rows_detected": total_rows,
        "columns_detected": len(detected_columns),
        "detected_columns": detected_columns[:80],
        "date_columns": date_columns,
        "numeric_columns": numeric_columns,
        "category_columns": category_columns,
        "data_quality_warnings": list(dict.fromkeys(warnings))[:24],
    }

    return {
        "profile": profile,
        "kpis": kpis[:12],
        "charts": charts[:8],
        "tables": tables[:6],
        "insights": insights[:8],
        "document_summaries": document_summaries,
        "source_files": source_files,
        "suggested_filters": [column for column in [date_col, supplier_col, category_col, status_col] if column],
    }
