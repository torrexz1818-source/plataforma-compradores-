from __future__ import annotations

import warnings
from pathlib import Path
from typing import Any

import pandas as pd

from app.agents.dashboard_creator.chart_recommender import recommend_chart_type
from app.document_processing.document_reader import read_document_text
from app.document_processing.file_detector import detect_file_type

AMOUNT_HINTS = ("monto", "importe", "total", "precio", "costo", "gasto", "valor", "amount", "price", "cost")
SUPPLIER_HINTS = ("proveedor", "supplier", "vendor", "empresa", "razon", "cliente")
CATEGORY_HINTS = ("categoria", "category", "rubro", "familia", "tipo", "linea", "producto", "servicio", "religion", "religión")
DATE_HINTS = ("fecha", "date", "periodo", "mes", "month", "year", "ano")
QUANTITY_HINTS = ("cantidad", "qty", "quantity", "unidades", "items")
STATUS_HINTS = ("estado", "status", "situacion")
PRODUCT_HINTS = ("producto", "item", "sku", "material", "articulo")
SERVICE_HINTS = ("servicio", "service", "prestacion")
CURRENCY_HINTS = ("moneda", "currency", "divisa")
PO_HINTS = ("orden", "oc", "purchase order", "po", "pedido")
REQUEST_HINTS = ("solicitud", "requisicion", "requerimiento", "rq")
BASE_PRICE_HINTS = ("precio base", "precio inicial", "precio lista", "base price")
PREVIOUS_PRICE_HINTS = ("precio anterior", "precio previo", "last price")
NEGOTIATED_PRICE_HINTS = ("precio negociado", "precio final", "negociado")
BUDGET_HINTS = ("presupuesto", "budget")
QUOTE_HINTS = ("cotizacion", "quote", "propuesta")
SAVINGS_HINTS = ("ahorro", "saving", "savings")
PROMISED_DATE_HINTS = ("fecha prometida", "fecha compromiso", "prometida", "promised")
ACTUAL_DATE_HINTS = ("fecha real", "fecha entrega", "entregado", "actual")
REQUESTED_QTY_HINTS = ("cantidad solicitada", "qty solicitada", "solicitado")
DELIVERED_QTY_HINTS = ("cantidad entregada", "qty entregada", "entregado")
PAYMENT_TERMS_HINTS = ("condicion de pago", "pago", "credito", "contado", "plazo")
RATING_HINTS = ("calificacion", "rating", "score", "evaluacion")
SURVEY_HINTS = ("encuesta", "satisfaccion", "survey")
NPS_HINTS = ("nps",)
FINANCIAL_IMPACT_HINTS = ("impacto financiero", "impacto", "financial impact")
SUPPLY_RISK_HINTS = ("riesgo suministro", "riesgo de suministro", "riesgo", "risk")
STOCK_HINTS = ("stock", "existencia", "existencias")
INVENTORY_HINTS = ("inventario", "almacen", "inventory")
LIQUIDATION_HINTS = ("liquidacion", "liquidation")
NUMERIC_EXCLUDE_HINTS = ("telefono", "teléfono", "celular", "dni", "ruc", "documento", "edad")
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
ANALYSIS_KEYWORDS = {
    "gastos": ("gasto", "gastos", "monto", "importe", "categoria", "proveedor", "ahorro"),
    "proveedores": ("proveedor", "supplier", "vendor", "desempeno", "riesgo", "ranking"),
    "compras": ("orden", "compra", "oc", "pedido", "requisicion", "cotizacion"),
    "contratos": ("contrato", "vencimiento", "renovacion", "obligacion", "penalidad"),
    "inventario": ("stock", "inventario", "almacen", "rotacion", "faltante"),
    "cotizaciones": ("cotizacion", "propuesta", "precio", "validez", "garantia", "plazo"),
    "cumplimiento": ("cumplimiento", "certificado", "homologacion", "auditoria"),
    "financiero": ("financiero", "presupuesto", "costo", "margen", "factura"),
}
BUYER_NODUS_COLORS = ["#0E109E", "#5A31D5", "#F3313F", "#B2EB4A", "#2F80ED", "#22A06B", "#F59E0B", "#64748B"]
FIELD_HINTS = {
    "proveedor": SUPPLIER_HINTS,
    "categoria": CATEGORY_HINTS,
    "producto": PRODUCT_HINTS,
    "servicio": SERVICE_HINTS,
    "monto": AMOUNT_HINTS,
    "moneda": CURRENCY_HINTS,
    "fecha": DATE_HINTS,
    "orden_compra": PO_HINTS,
    "solicitud": REQUEST_HINTS,
    "requerimiento": REQUEST_HINTS,
    "precio_base": BASE_PRICE_HINTS,
    "precio_anterior": PREVIOUS_PRICE_HINTS,
    "precio_negociado": NEGOTIATED_PRICE_HINTS,
    "presupuesto": BUDGET_HINTS,
    "cotizacion": QUOTE_HINTS,
    "ahorro": SAVINGS_HINTS,
    "fecha_prometida": PROMISED_DATE_HINTS,
    "fecha_real": ACTUAL_DATE_HINTS,
    "cantidad_solicitada": REQUESTED_QTY_HINTS,
    "cantidad_entregada": DELIVERED_QTY_HINTS,
    "estado_cumplimiento": STATUS_HINTS,
    "condicion_pago": PAYMENT_TERMS_HINTS,
    "credito": ("credito",),
    "contado": ("contado",),
    "plazo": ("plazo",),
    "calificacion": RATING_HINTS,
    "encuesta": SURVEY_HINTS,
    "nps": NPS_HINTS,
    "impacto_financiero": FINANCIAL_IMPACT_HINTS,
    "riesgo_suministro": SUPPLY_RISK_HINTS,
    "stock": STOCK_HINTS,
    "inventario": INVENTORY_HINTS,
    "liquidacion": LIQUIDATION_HINTS,
}


def _read_table(path: Path, file_type: str) -> pd.DataFrame | None:
    if file_type == "csv":
        try:
            return pd.read_csv(path)
        except UnicodeDecodeError:
            return pd.read_csv(path, encoding="latin-1")
        except pd.errors.ParserError:
            return pd.read_csv(path, sep=None, engine="python")
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


def _excel_sheet_names(path: Path, file_type: str) -> list[str]:
    if file_type != "xlsx":
        return []
    try:
        return [str(sheet) for sheet in pd.ExcelFile(path).sheet_names]
    except Exception:
        return []


def _header_score(row: pd.Series) -> int:
    text = " ".join(str(value).strip().lower() for value in row.dropna().tolist())
    hints = (
        "fecha",
        "pago",
        "monto",
        "nombre",
        "proveedor",
        "categoria",
        "religion",
        "telefono",
        "direccion",
        "edad",
        "niño",
        "nino",
    )
    non_empty = row.dropna().astype(str).str.strip()
    return sum(1 for hint in hints if hint in text) + min(len(non_empty), 6)


def _dedupe_columns(columns: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    clean_columns = []
    for index, column in enumerate(columns, start=1):
        base = str(column).strip()
        if not base or base.lower() in {"nan", "none", "unnamed"}:
            base = f"Columna {index}"
        count = seen.get(base, 0)
        seen[base] = count + 1
        clean_columns.append(base if count == 0 else f"{base} {count + 1}")
    return clean_columns


def _promote_embedded_header(frame: pd.DataFrame) -> pd.DataFrame:
    raw_columns = [str(column).lower() for column in frame.columns]
    unnamed_ratio = sum(column.startswith("unnamed") for column in raw_columns) / max(len(raw_columns), 1)
    candidate_rows = frame.head(8)
    best_index = None
    best_score = 0

    for index, row in candidate_rows.iterrows():
        score = _header_score(row)
        if score > best_score:
            best_score = score
            best_index = index

    if best_index is None or (unnamed_ratio < 0.45 and best_score < 7):
        return frame

    promoted = frame.loc[best_index + 1 :].copy()
    promoted.columns = _dedupe_columns([str(value).strip() for value in frame.loc[best_index].tolist()])
    return promoted.reset_index(drop=True)


def _clean_frame(frame: pd.DataFrame) -> pd.DataFrame:
    frame = _promote_embedded_header(frame)
    frame = frame.dropna(how="all").dropna(axis=1, how="all")
    frame.columns = _dedupe_columns([str(column).strip() for column in frame.columns])
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


def _numeric_likeness(series: pd.Series) -> float:
    values = series.dropna().astype(str).str.strip()
    if values.empty:
        return 0
    pattern = r"^[S/$€\s-]*\d{1,3}([.,]\d{3})*([.,]\d+)?\s*$|^[S/$€\s-]*\d+([.,]\d+)?\s*$"
    return float(values.str.match(pattern, case=False).mean())


def _parse_dates_quiet(values: pd.Series) -> pd.Series:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        return pd.to_datetime(values, errors="coerce", dayfirst=True)


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
        numeric_likeness = _numeric_likeness(values)
        parsed_dates = _parse_dates_quiet(values)
        date_ratio = parsed_dates.notna().mean()

        has_numeric_hint = any(hint in lower for hint in AMOUNT_HINTS + QUANTITY_HINTS)
        is_excluded_numeric = any(hint in lower for hint in NUMERIC_EXCLUDE_HINTS)
        is_generic_numeric = lower.startswith("columna") or lower.startswith("column") or lower.startswith("unnamed")

        if has_numeric_hint and not is_excluded_numeric:
            numeric_columns.append(column)
        elif numeric_likeness >= 0.65 and not is_excluded_numeric and not is_generic_numeric:
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


def _is_generic_column(column: str | None) -> bool:
    if not column:
        return True
    lower = column.strip().lower()
    return lower.startswith("columna") or lower.startswith("column") or lower.startswith("unnamed")


def _best_amount_column(columns: list[str]) -> str | None:
    hinted = _hint_column(columns, AMOUNT_HINTS)
    if hinted and not _is_generic_column(hinted):
        return hinted
    return None


def _hint_column(columns: list[str], hints: tuple[str, ...]) -> str | None:
    for column in columns:
        lower = column.lower()
        if any(hint in lower for hint in hints):
            return column
    return None


def _usable_category_columns(columns: list[str]) -> list[str]:
    noisy_hints = ("direccion", "dirección", "telefono", "teléfono", "nombre", "hoja", "sheet")
    return [column for column in columns if not any(hint in column.lower() for hint in noisy_hints)]


def _format_number(value: float | int | None) -> str:
    if value is None or pd.isna(value):
        return "0"
    return f"{float(value):,.2f}"


def _normalize_column_name(column: str) -> str:
    normalized = str(column).strip().lower()
    replacements = {
        "á": "a",
        "é": "e",
        "í": "i",
        "ó": "o",
        "ú": "u",
        "ñ": "n",
    }
    for source, target in replacements.items():
        normalized = normalized.replace(source, target)
    return "_".join(part for part in normalized.replace("/", " ").replace("-", " ").split() if part)


def _column_type(series: pd.Series) -> str:
    values = series.dropna()
    if values.empty:
        return "empty"
    if _numeric_likeness(values) >= 0.65:
        return "number"
    if _parse_dates_quiet(values).notna().mean() >= 0.55:
        return "date"
    return "category" if values.nunique(dropna=True) <= max(35, len(values) * 0.72) else "text"


def _column_profiles(frame: pd.DataFrame) -> list[dict[str, Any]]:
    profiles: list[dict[str, Any]] = []
    if frame.empty:
        return profiles
    visible_columns = [column for column in frame.columns if not str(column).startswith("__")]
    for column in visible_columns[:80]:
        values = frame[column]
        examples = [str(value)[:80] for value in values.dropna().head(4).tolist()]
        profiles.append(
            {
                "original_name": str(column),
                "normalized_name": _normalize_column_name(str(column)),
                "detected_type": _column_type(values),
                "null_percentage": round(float(values.isna().mean()), 4),
                "examples": examples,
            }
        )
    return profiles


def _candidate_fields(columns: list[str]) -> dict[str, list[str]]:
    candidates: dict[str, list[str]] = {}
    for field, hints in FIELD_HINTS.items():
        matches = [column for column in columns if any(hint in column.lower() for hint in hints)]
        if matches:
            candidates[field] = matches[:5]
    return candidates


def _candidate_col(candidates: dict[str, list[str]], *fields: str) -> str | None:
    for field in fields:
        values = candidates.get(field) or []
        for column in values:
            if column and not _is_generic_column(column):
                return column
    return None


def _row_samples(frame: pd.DataFrame, max_rows: int = 5) -> list[dict[str, Any]]:
    if frame.empty:
        return []
    visible_columns = [column for column in frame.columns if not str(column).startswith("__")][:12]
    samples = frame[visible_columns].head(max_rows).where(pd.notna(frame[visible_columns].head(max_rows)), None)
    return [{str(key): value for key, value in row.items()} for row in samples.to_dict(orient="records")]


def _date_range(frame: pd.DataFrame, date_columns: list[str]) -> dict[str, str] | None:
    for column in date_columns:
        parsed = _parse_dates_quiet(frame[column]).dropna() if column in frame else pd.Series(dtype="datetime64[ns]")
        if not parsed.empty:
            return {"column": column, "min": str(parsed.min().date()), "max": str(parsed.max().date())}
    return None


def _basic_stats(frame: pd.DataFrame, numeric_columns: list[str], date_columns: list[str], category_columns: list[str]) -> dict[str, Any]:
    stats: dict[str, Any] = {
        "rows": int(len(frame)),
        "columns": len([column for column in frame.columns if not str(column).startswith("__")]) if not frame.empty else 0,
        "possible_totals": {},
        "counts": {},
        "date_range": _date_range(frame, date_columns) if not frame.empty else None,
        "top_unique_values": {},
        "relevant_nulls": {},
    }
    if frame.empty:
        return stats
    for column in numeric_columns[:8]:
        if column in frame:
            values = _to_numeric(frame[column]).dropna()
            if not values.empty:
                stats["possible_totals"][column] = round(float(values.sum()), 2)
    for column in category_columns[:8]:
        if column in frame:
            values = frame[column].dropna().astype(str).str.strip()
            stats["counts"][column] = int(values.nunique())
            stats["top_unique_values"][column] = values.value_counts().head(5).to_dict()
    nulls = frame.isna().sum().sort_values(ascending=False)
    stats["relevant_nulls"] = {str(column): int(count) for column, count in nulls.head(10).items() if count > 0 and not str(column).startswith("__")}
    return stats


def _analysis_capabilities(candidates: dict[str, list[str]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    rules = [
        ("compras_totales", ["monto"], "Compras totales"),
        ("compras_por_categoria", ["monto", "categoria"], "Compras por categoria"),
        ("compras_por_proveedor", ["monto", "proveedor"], "Compras por proveedor"),
        ("productos_servicios", ["producto|servicio"], "Productos o servicios"),
        ("ahorro", ["ahorro|precio_base", "precio_negociado|ahorro"], "Ahorro"),
        ("cumplimiento_simple", ["estado_cumplimiento"], "Cumplimiento simple"),
        ("otif", ["fecha_prometida", "fecha_real", "cantidad_solicitada", "cantidad_entregada"], "OTIF"),
        ("nps", ["nps"], "NPS"),
        ("satisfaccion", ["calificacion|encuesta"], "Satisfaccion"),
        ("kraljic", ["impacto_financiero", "riesgo_suministro"], "Kraljic"),
        ("ciclo_compra", ["fecha", "fecha_real"], "Ciclo de compra"),
        ("condiciones_pago", ["condicion_pago"], "Condiciones de pago"),
        ("riesgo_concentracion", ["monto", "proveedor"], "Riesgo/concentracion"),
        ("stock_inventario_liquidaciones", ["stock|inventario|liquidacion"], "Stock/inventario/liquidaciones"),
    ]
    possible: list[dict[str, Any]] = []
    not_possible: list[dict[str, Any]] = []
    for code, required_fields, label in rules:
        missing = []
        for field in required_fields:
            alternatives = field.split("|")
            if not any(alternative in candidates for alternative in alternatives):
                missing.append(" o ".join(alternatives))
        if missing:
            not_possible.append(
                {
                    "analysis": code,
                    "label": label,
                    "reason": "Faltan campos requeridos.",
                    "missing_fields": missing,
                    "recommendation": f"Agregar columna(s): {', '.join(missing)}.",
                }
            )
        else:
            possible.append({"analysis": code, "label": label, "required_fields": required_fields, "confidence": "high" if len(required_fields) <= 2 else "medium"})
    return possible, not_possible


def _with_chart_presentation(chart: dict[str, Any]) -> dict[str, Any]:
    data = chart.get("data") if isinstance(chart.get("data"), list) else []
    total = sum(float(point.get("value") or 0) for point in data if isinstance(point, dict))
    legend = []
    for index, point in enumerate(data[:12]):
        if not isinstance(point, dict):
            continue
        value = float(point.get("value") or 0)
        suffix = f" ({value / total:.1%})" if total else ""
        legend.append({"label": str(point.get("label") or "Sin etiqueta"), "value": f"{_format_number(value)}{suffix}", "color": BUYER_NODUS_COLORS[index % len(BUYER_NODUS_COLORS)]})
    chart["legend"] = chart.get("legend") or legend
    chart["colors"] = chart.get("colors") or BUYER_NODUS_COLORS[: max(1, min(len(data), len(BUYER_NODUS_COLORS)))]
    return chart


def _append_kpi(kpis: list[dict[str, Any]], title: str, value: str, description: str, logic: str, *, confidence: str = "high", unit: str | None = None, status: str = "neutral") -> None:
    kpis.append(
        {
            "title": title,
            "value": value,
            "description": description,
            "calculation_logic": logic,
            "source": "calculated",
            "confidence": confidence,
            "unit": unit,
            "status": status,
        }
    )


def _clean_text_series(series: pd.Series) -> pd.Series:
    return series.dropna().astype(str).str.strip()


def _truthy_status(series: pd.Series) -> pd.Series:
    text = series.astype(str).str.lower()
    return text.str.contains("cumpl|complet|entreg|aprob|ok|si|sí|yes|true", regex=True, na=False)


def _is_nps_scale(values: pd.Series) -> bool:
    numeric = _to_numeric(values).dropna()
    if numeric.empty:
        return False
    return numeric.between(0, 10).all() and numeric.nunique() >= 3


def _date_diff_days(start: pd.Series, end: pd.Series) -> pd.Series:
    start_dates = _parse_dates_quiet(start)
    end_dates = _parse_dates_quiet(end)
    return (end_dates - start_dates).dt.days


def _add_chart(charts: list[dict[str, Any]], chart_id: str, title: str, chart_type: str, description: str, data: list[dict[str, Any]], insight: str, *, x_axis: str | None = None, y_axis: str | None = None, confidence: str = "high") -> None:
    if not data:
        return
    charts.append(
        _with_chart_presentation(
            {
                "chart_id": chart_id,
                "title": title,
                "type": chart_type,
                "description": description,
                "x_axis": x_axis,
                "y_axis": y_axis,
                "data": data,
                "data_source": "python_calculated",
                "confidence": confidence,
                "insight": insight,
            }
        )
    )


def _deterministic_procurement_outputs(
    frame: pd.DataFrame,
    candidates: dict[str, list[str]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    kpis: list[dict[str, Any]] = []
    charts: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    insights: list[dict[str, Any]] = []
    warnings: list[str] = []
    if frame.empty:
        return kpis, charts, tables, insights, warnings

    amount_col = _candidate_col(candidates, "monto")
    supplier_col = _candidate_col(candidates, "proveedor")
    category_col = _candidate_col(candidates, "categoria")
    product_col = _candidate_col(candidates, "producto", "servicio")
    currency_col = _candidate_col(candidates, "moneda")
    date_col = _candidate_col(candidates, "fecha")
    base_price_col = _candidate_col(candidates, "precio_base", "precio_anterior", "presupuesto")
    negotiated_price_col = _candidate_col(candidates, "precio_negociado")
    savings_col = _candidate_col(candidates, "ahorro")
    status_col = _candidate_col(candidates, "estado_cumplimiento")
    promised_date_col = _candidate_col(candidates, "fecha_prometida")
    actual_date_col = _candidate_col(candidates, "fecha_real")
    requested_qty_col = _candidate_col(candidates, "cantidad_solicitada")
    delivered_qty_col = _candidate_col(candidates, "cantidad_entregada")
    nps_col = _candidate_col(candidates, "nps")
    rating_col = _candidate_col(candidates, "calificacion", "encuesta")
    payment_col = _candidate_col(candidates, "condicion_pago", "credito", "contado", "plazo")
    stock_col = _candidate_col(candidates, "stock", "inventario", "liquidacion")
    impact_col = _candidate_col(candidates, "impacto_financiero")
    supply_risk_col = _candidate_col(candidates, "riesgo_suministro")
    po_col = _candidate_col(candidates, "orden_compra")
    request_col = _candidate_col(candidates, "solicitud", "requerimiento")

    if currency_col and amount_col:
        currency_rows = _top_group(frame, currency_col, amount_col, limit=8)
        _add_chart(charts, "amount_by_currency", "Compras por moneda", "donut", "Monto total agrupado por moneda detectada.", currency_rows, "Permite separar exposicion por moneda.", x_axis=currency_col, y_axis=amount_col, confidence="medium")
        tables.append({"title": "Compras por moneda", "description": "Montos agrupados por moneda.", "source": "python", "columns": ["Ranking", "Moneda", "Monto", "Participacion"], "rows": _summary_table(currency_rows, "Moneda", "Monto")})

    if product_col:
        if amount_col:
            product_rows = _top_group(frame, product_col, amount_col, limit=10)
            _add_chart(charts, "top_products_services", "Top productos/servicios por monto", "horizontal_bar", "Ranking de productos o servicios por monto.", product_rows, "Ayuda a detectar items de mayor impacto.", x_axis=product_col, y_axis=amount_col)
            tables.append({"title": "Resumen por producto/servicio", "description": "Productos o servicios con mayor monto.", "source": "python", "columns": ["Ranking", "Producto/Servicio", "Monto", "Participacion"], "rows": _summary_table(product_rows, "Producto/Servicio", "Monto")})
        else:
            counts = _clean_text_series(frame[product_col]).value_counts().head(10)
            product_rows = [{"label": str(label), "value": int(value)} for label, value in counts.items()]
            _add_chart(charts, "top_products_services_count", "Top productos/servicios por registros", "bar", "Frecuencia de productos o servicios detectados.", product_rows, "Muestra recurrencia por item.", x_axis=product_col, y_axis="Registros", confidence="medium")

    if base_price_col and negotiated_price_col:
        base = _to_numeric(frame[base_price_col])
        negotiated = _to_numeric(frame[negotiated_price_col])
        savings = (base - negotiated).dropna()
        valid = savings[base.notna() & negotiated.notna()]
        if not valid.empty:
            total_savings = float(valid.sum())
            valid_base = base[base.notna() & negotiated.notna()]
            savings_pct = total_savings / float(valid_base.sum()) if float(valid_base.sum()) else 0
            _append_kpi(kpis, "Ahorro calculado", _format_number(total_savings), f"Diferencia entre {base_price_col} y {negotiated_price_col}.", f"SUM({base_price_col} - {negotiated_price_col})", unit="monto", status="positive" if total_savings > 0 else "neutral")
            _append_kpi(kpis, "Porcentaje de ahorro", f"{savings_pct:.1%}", "Ahorro calculado sobre precio base total.", f"SUM(ahorro) / SUM({base_price_col})", unit="%", status="positive" if savings_pct > 0 else "neutral")
    elif savings_col:
        declared = _to_numeric(frame[savings_col]).dropna()
        if not declared.empty:
            _append_kpi(kpis, "Ahorro declarado", _format_number(float(declared.sum())), f"Suma de la columna {savings_col}; validar criterio de origen.", f"SUM({savings_col})", confidence="medium", unit="monto", status="positive")
    else:
        warnings.append("No se calculo ahorro porque faltan precio base/anterior/presupuesto y precio negociado, o una columna de ahorro declarada.")

    if status_col:
        status_values = frame[status_col].dropna()
        total = int(len(status_values))
        if total:
            complied = int(_truthy_status(status_values).sum())
            not_complied = total - complied
            compliance = complied / total
            _append_kpi(kpis, "Cumplimiento simple", f"{compliance:.1%}", f"Registros cumplidos segun {status_col}. No equivale a OTIF completo.", f"Cumplidos / total registros en {status_col}", unit="%", status="positive" if compliance >= 0.9 else "warning")
            data = [{"label": "Cumplidos", "value": complied}, {"label": "No cumplidos", "value": not_complied}]
            _add_chart(charts, "simple_compliance", "Cumplimiento simple", "donut", "Distribucion de cumplidos y no cumplidos.", data, "Mide cumplimiento declarado; no mide entrega a tiempo y completa.", x_axis=status_col, y_axis="Registros", confidence="medium")
            tables.append({"title": "Resumen de cumplimiento simple", "description": "Conteo por estado de cumplimiento.", "source": "python", "columns": ["Estado", "Registros"], "rows": [{"Estado": item["label"], "Registros": item["value"]} for item in data]})

    if promised_date_col and actual_date_col and requested_qty_col and delivered_qty_col:
        promised = _parse_dates_quiet(frame[promised_date_col])
        actual = _parse_dates_quiet(frame[actual_date_col])
        requested = _to_numeric(frame[requested_qty_col])
        delivered = _to_numeric(frame[delivered_qty_col])
        valid = promised.notna() & actual.notna() & requested.notna() & delivered.notna()
        if valid.any():
            on_time = actual[valid] <= promised[valid]
            in_full = delivered[valid] >= requested[valid]
            otif = on_time & in_full
            total = int(valid.sum())
            _append_kpi(kpis, "On Time", f"{float(on_time.mean()):.1%}", "Entregas realizadas en o antes de la fecha prometida.", f"{actual_date_col} <= {promised_date_col}", unit="%", status="positive" if float(on_time.mean()) >= 0.9 else "warning")
            _append_kpi(kpis, "In Full", f"{float(in_full.mean()):.1%}", "Entregas con cantidad entregada mayor o igual a solicitada.", f"{delivered_qty_col} >= {requested_qty_col}", unit="%", status="positive" if float(in_full.mean()) >= 0.9 else "warning")
            _append_kpi(kpis, "OTIF", f"{float(otif.mean()):.1%}", "Entregas completas y a tiempo.", "On Time AND In Full", unit="%", status="positive" if float(otif.mean()) >= 0.9 else "warning")
            _add_chart(charts, "otif_breakdown", "OTIF", "bar", "On Time, In Full y OTIF calculados con fechas y cantidades.", [{"label": "On Time", "value": round(float(on_time.mean()) * 100, 2)}, {"label": "In Full", "value": round(float(in_full.mean()) * 100, 2)}, {"label": "OTIF", "value": round(float(otif.mean()) * 100, 2)}], f"OTIF calculado sobre {total} registros validos.", y_axis="%")
    elif promised_date_col or actual_date_col or requested_qty_col or delivered_qty_col:
        warnings.append("No se calculo OTIF porque faltan fecha prometida, fecha real, cantidad solicitada o cantidad entregada.")

    score_col = nps_col or rating_col
    if score_col:
        scores = _to_numeric(frame[score_col]).dropna()
        if not scores.empty and nps_col and _is_nps_scale(scores):
            promoters = int((scores >= 9).sum())
            passives = int(((scores >= 7) & (scores <= 8)).sum())
            detractors = int((scores <= 6).sum())
            total = len(scores)
            nps_value = ((promoters / total) - (detractors / total)) * 100 if total else 0
            _append_kpi(kpis, "NPS", f"{nps_value:.1f}", "NPS calculado con escala 0-10.", "(% promotores) - (% detractores)", unit="puntos", status="positive" if nps_value >= 30 else "warning")
            _add_chart(charts, "nps_distribution", "Distribucion NPS", "bar", "Promotores, neutros y detractores.", [{"label": "Promotores", "value": promoters}, {"label": "Neutros", "value": passives}, {"label": "Detractores", "value": detractors}], "Clasifica respuestas NPS segun escala 0-10.", x_axis=score_col, y_axis="Respuestas")
        elif not scores.empty:
            _append_kpi(kpis, "Satisfaccion promedio", f"{float(scores.mean()):.2f}", f"Promedio de calificacion detectada en {score_col}. No se etiqueta como NPS.", f"AVG({score_col})", confidence="medium", unit="score", status="neutral")
            counts = scores.round(0).value_counts().sort_index()
            _add_chart(charts, "rating_distribution", "Distribucion de calificaciones", "bar", "Frecuencia por calificacion detectada.", [{"label": str(label), "value": int(value)} for label, value in counts.items()], "Muestra dispersion de satisfaccion/calificaciones.", x_axis=score_col, y_axis="Respuestas", confidence="medium")

    if payment_col:
        payment_text = _clean_text_series(frame[payment_col])
        if not payment_text.empty:
            credit = int(payment_text.str.lower().str.contains("credito|crédito", regex=True, na=False).sum())
            cash = int(payment_text.str.lower().str.contains("contado", regex=True, na=False).sum())
            _append_kpi(kpis, "Condiciones de pago detectadas", str(int(payment_text.nunique())), f"Valores unicos en {payment_col}.", f"COUNT DISTINCT({payment_col})", confidence="medium")
            data = [{"label": "Credito", "value": credit}, {"label": "Contado", "value": cash}]
            if credit or cash:
                _add_chart(charts, "payment_terms", "Credito vs contado", "donut", "Distribucion de condiciones de pago detectadas.", data, "Solo clasifica condiciones explicitas.", x_axis=payment_col, y_axis="Registros", confidence="medium")
            if amount_col:
                payment_rows = _top_group(frame, payment_col, amount_col, limit=10)
                tables.append({"title": "Monto por condicion de pago", "description": "Montos agrupados por condicion/plazo de pago.", "source": "python", "columns": ["Ranking", "Condicion", "Monto", "Participacion"], "rows": _summary_table(payment_rows, "Condicion", "Monto")})

    if impact_col and supply_risk_col:
        kraljic_frame = frame[[impact_col, supply_risk_col]].copy()
        kraljic_frame[impact_col] = kraljic_frame[impact_col].astype(str).str.strip()
        kraljic_frame[supply_risk_col] = kraljic_frame[supply_risk_col].astype(str).str.strip()
        kraljic_frame = kraljic_frame.dropna()
        if not kraljic_frame.empty:
            grouped = kraljic_frame.groupby([impact_col, supply_risk_col]).size().sort_values(ascending=False).head(12)
            rows = [
                {"Impacto financiero": str(index[0]), "Riesgo de suministro": str(index[1]), "Registros": int(value)}
                for index, value in grouped.items()
                if isinstance(index, tuple)
            ]
            tables.append({"title": "Matriz Kraljic base", "description": "Cruce de impacto financiero y riesgo de suministro detectados. No clasifica si los datos no traen ambas dimensiones.", "source": "python", "columns": ["Impacto financiero", "Riesgo de suministro", "Registros"], "rows": rows})
            _add_chart(charts, "kraljic_base_matrix", "Matriz Kraljic base", "matrix", "Conteo por impacto financiero y riesgo de suministro.", [{"label": f"{row['Impacto financiero']} / {row['Riesgo de suministro']}", "value": row["Registros"]} for row in rows], "Permite ubicar segmentos si el dataset trae riesgo e impacto.", x_axis=impact_col, y_axis=supply_risk_col, confidence="medium")

    if request_col and po_col:
        days = _date_diff_days(frame[request_col], frame[po_col]).dropna()
        if not days.empty:
            _append_kpi(kpis, "Ciclo solicitud a OC", f"{float(days.mean()):.1f}", f"Dias promedio entre {request_col} y {po_col}.", f"AVG({po_col} - {request_col})", unit="dias", status="neutral")
    elif (request_col or po_col) and not (request_col and po_col):
        warnings.append("No se calcularon ciclos de compra porque falta una segunda fecha comparable.")

    if stock_col:
        stock = _to_numeric(frame[stock_col]).dropna()
        if not stock.empty:
            _append_kpi(kpis, "Stock total detectado", _format_number(float(stock.sum())), f"Suma de {stock_col}.", f"SUM({stock_col})", confidence="medium", unit="unidades")
            if product_col:
                stock_frame = frame[[product_col, stock_col]].copy()
                stock_frame[stock_col] = _to_numeric(stock_frame[stock_col])
                stock_frame = stock_frame.dropna(subset=[product_col, stock_col])
                grouped = stock_frame.groupby(product_col)[stock_col].sum().sort_values(ascending=False).head(10)
                stock_rows = [{"label": str(label), "value": round(float(value), 2)} for label, value in grouped.items()]
                _add_chart(charts, "inventory_stock", "Productos con mayor stock", "horizontal_bar", "Stock disponible por producto/servicio.", stock_rows, "Identifica potenciales excesos o focos de liquidacion.", x_axis=product_col, y_axis=stock_col, confidence="medium")
            if not amount_col and not base_price_col and not negotiated_price_col:
                warnings.append("Se detecto stock, pero no se calculo valor monetario de inventario porque falta costo/precio.")

    return kpis, charts, tables, insights, warnings


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
    values[date_col] = _parse_dates_quiet(values[date_col])
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


def _detect_document_title(text: str) -> str | None:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for index, line in enumerate(lines[:35]):
        upper = line.upper()
        if "INFORME" in upper and ("ECONOM" in upper or "DASHBOARD" in upper or "REPORTE" in upper):
            next_line = lines[index + 1].strip() if index + 1 < len(lines) else ""
            title = f"{line} {next_line}" if next_line and len(line) < 80 and not next_line.lower().startswith(("iasd", "enero", "s/")) else line
            return " ".join(title.split())[:140]
    return None


def _tabular_excerpt(frame: pd.DataFrame, max_rows: int = 80) -> str:
    visible_columns = [column for column in frame.columns if not str(column).startswith("__")]
    if not visible_columns:
        return ""
    compact = frame[visible_columns].head(max_rows).copy()
    return compact.to_csv(index=False)[:9000]


def _detect_analysis_type(columns: list[str], document_summaries: list[dict[str, Any]], requested_type: str | None = None) -> str:
    haystack = " ".join(columns + [str(requested_type or "")]).lower()
    for doc in document_summaries:
        haystack += " " + " ".join(doc.get("relevant_findings", []))
        haystack += " " + str(doc.get("llm_excerpt", ""))

    scores = {
        analysis_type: sum(1 for keyword in keywords if keyword in haystack)
        for analysis_type, keywords in ANALYSIS_KEYWORDS.items()
    }
    detected, score = max(scores.items(), key=lambda item: item[1])
    return detected if score else "mixto"


def _build_data_understanding(
    *,
    source_files: list[dict[str, Any]],
    rows_detected: int,
    detected_columns: list[str],
    numeric_columns: list[str],
    date_columns: list[str],
    category_columns: list[str],
    document_summaries: list[dict[str, Any]],
) -> dict[str, Any]:
    source_types = sorted({str(item.get("detected_type") or "unknown") for item in source_files})
    has_structured = rows_detected > 0
    has_documents = any(item.get("detected_type") not in {"xlsx", "csv"} for item in document_summaries)

    if has_structured and has_documents:
        analysis_mode = "mixed"
    elif has_structured:
        analysis_mode = "structured_data"
    else:
        analysis_mode = "document_based"

    if has_structured and numeric_columns and (category_columns or date_columns):
        structure_level = "high"
        confidence = "high"
        confidence_reason = "Confianza alta porque se detectaron datos tabulares con columnas numericas y campos para segmentar o analizar tendencias."
    elif has_structured or any(item.get("relevant_findings") for item in document_summaries):
        structure_level = "medium"
        confidence = "medium"
        confidence_reason = "Confianza media porque existe informacion util, pero faltan algunas columnas claras o parte del soporte viene de documentos extraidos."
    else:
        structure_level = "low"
        confidence = "low"
        confidence_reason = "Confianza baja porque no se detecto una tabla estructurada suficiente y el resultado depende de texto extraido o informacion parcial."

    notes = []
    if has_structured:
        notes.append("Se detectaron datos tabulares procesables con Python.")
    if has_documents:
        notes.append("Se detectaron documentos o imagenes que requieren sintesis documental.")
    if not numeric_columns:
        notes.append("No hay columna numerica clara para calculos financieros precisos.")
    if not category_columns:
        notes.append("No hay columna categorica clara para segmentar por proveedor, categoria o area.")

    return {
        "analysis_mode": analysis_mode,
        "confidence_level": confidence,
        "confidence_reason": confidence_reason,
        "data_understanding": {
            "files_processed": len(source_files),
            "source_types": source_types,
            "detected_analysis_type": _detect_analysis_type(detected_columns, document_summaries),
            "structure_level": structure_level,
            "notes": notes,
        },
    }


def _build_document_only_outputs(document_summaries: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    document_only_summaries = [item for item in document_summaries if item.get("detected_type") not in {"xlsx", "csv"}]
    if not document_only_summaries:
        return [], [], []

    kpis = [
        {
            "title": "Documentos leidos",
            "value": str(len(document_only_summaries)),
            "description": "Archivos no tabulares procesados con MarkItDown/fallback documental.",
            "calculation_logic": "Conteo de documentos procesados.",
            "source": "python",
            "confidence": "medium",
        }
    ]
    rows = []
    for doc in document_only_summaries:
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
            "source": "python",
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
    suggested_title: str | None = None

    for path, filename in files:
        file_type = detect_file_type(filename)
        source_files.append(
            {
                "file_name": filename,
                "detected_type": file_type,
                "size_bytes": path.stat().st_size if path.exists() else None,
                "sheets": _excel_sheet_names(path, file_type),
                "tables_detected": 0,
            }
        )
        if file_type in {"xlsx", "csv"}:
            frame = _read_table(path, file_type)
            if frame is None or frame.empty:
                warnings.append(f"{filename}: no se detectaron filas tabulares.")
                continue
            frame = _clean_frame(frame)
            if frame.empty:
                warnings.append(f"{filename}: la tabla queda vacia despues de limpiar filas/columnas vacias.")
                continue
            source_files[-1]["tables_detected"] = 1
            frame["__source_file"] = filename
            frames.append(frame)
            document_summaries.append(
                {
                    "file_name": filename,
                    "detected_type": file_type,
                    "text_preview": None,
                    "detected_title": None,
                    "llm_excerpt": _tabular_excerpt(frame),
                    "relevant_findings": [
                        "tabla",
                        "datos estructurados",
                        "columnas: " + ", ".join([column for column in frame.columns if not str(column).startswith("__")][:12]),
                    ],
                    "limitations": ["Muestra compacta enviada al LLM; validar contra el archivo fuente antes de decidir."],
                }
            )
            detected_columns.extend([column for column in frame.columns if not column.startswith("__")])
            n_cols, d_cols, c_cols = _detect_columns(frame)
            numeric_columns.extend(n_cols)
            date_columns.extend(d_cols)
            category_columns.extend(c_cols)
        else:
            text, detected_type, file_warnings = read_document_text(path, filename)
            compact = text[:2500]
            findings = _text_relevance(compact)
            detected_title = _detect_document_title(compact)
            if detected_title and not suggested_title:
                suggested_title = detected_title
            document_summaries.append(
                {
                    "file_name": filename,
                    "detected_type": detected_type,
                    "text_preview": None,
                    "detected_title": detected_title,
                    "llm_excerpt": compact[:1200],
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

    amount_col = _best_amount_column(numeric_columns) if not combined.empty else None
    quantity_col = _hint_column(numeric_columns, QUANTITY_HINTS) if not combined.empty else None
    if _is_generic_column(quantity_col):
        quantity_col = None
    usable_category_columns = _usable_category_columns(category_columns)
    supplier_col = _hint_column(usable_category_columns, SUPPLIER_HINTS) if not combined.empty else None
    category_col = _hint_column(usable_category_columns, CATEGORY_HINTS) if not combined.empty else None
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
                "source": "python",
                "confidence": "high",
            }
        )
        kpis.append(
            {
                "title": "Columnas detectadas",
                "value": str(len(detected_columns)),
                "description": "Campos disponibles para armar filtros, KPIs y graficos.",
                "calculation_logic": "Conteo de columnas no tecnicas.",
                "source": "python",
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
                    "source": "python",
                    "confidence": "high",
                },
                {
                    "title": "Ticket promedio",
                    "value": _format_number(avg_amount),
                    "description": f"Promedio de la columna {amount_col}.",
                    "calculation_logic": f"AVG({amount_col})",
                    "source": "python",
                    "confidence": "high",
                },
                {
                    "title": "Mayor registro",
                    "value": _format_number(max_amount),
                    "description": f"Valor maximo detectado en {amount_col}.",
                    "calculation_logic": f"MAX({amount_col})",
                    "source": "python",
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
                "source": "python",
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
                "source": "python",
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
                    "source": "python",
                    "confidence": "medium",
                }
            )

    if date_col:
        parsed_dates = _parse_dates_quiet(combined[date_col]).dropna()
        if not parsed_dates.empty:
            kpis.append(
                {
                    "title": "Periodo detectado",
                    "value": f"{parsed_dates.min().date()} a {parsed_dates.max().date()}",
                    "description": f"Rango de fechas encontrado en {date_col}.",
                    "calculation_logic": f"MIN/MAX({date_col})",
                    "source": "python",
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
                "data_source": "python_calculated",
                "confidence": "high",
                "insight": "Permite detectar concentracion de gasto y dependencia por proveedor.",
            }
        )
        if 2 <= len(top_suppliers) <= 8:
            charts.append(
                {
                    "chart_id": "supplier_share",
                    "title": "Participacion por proveedor",
                    "type": "donut",
                    "description": "Participacion relativa de los principales proveedores detectados.",
                    "x_axis": supplier_col,
                    "y_axis": amount_col,
                    "data": top_suppliers,
                    "data_source": "python_calculated",
                    "confidence": "high",
                    "insight": "Visualiza rapidamente que proveedores concentran la mayor parte del monto analizado.",
                }
            )
        tables.append(
            {
                "title": "Resumen por proveedor",
                "description": "Top proveedores por monto acumulado y participacion.",
                "source": "python",
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
                    "source": "python",
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
                "type": "horizontal_bar" if len(top_categories) > 6 else "pie" if 2 <= len(top_categories) <= 5 else "bar",
                "description": "Distribucion de monto por categoria.",
                "x_axis": category_col,
                "y_axis": amount_col,
                "data": top_categories,
                "data_source": "python_calculated",
                "confidence": "high",
                "insight": "Ayuda a priorizar categorias de mayor impacto economico.",
            }
        )
        tables.append(
            {
                "title": "Resumen por categoria",
                "description": "Categorias con mayor monto acumulado.",
                "source": "python",
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
                    "data_source": "python_calculated",
                    "confidence": "high",
                    "insight": "Muestra variaciones temporales, picos y posibles estacionalidades.",
                }
            )
            rows = [{"Periodo": item["label"], "Monto": _format_number(item["value"])} for item in trend]
            tables.append(
                {
                    "title": "Evolucion por periodo",
                    "description": "Monto agrupado por mes detectado.",
                    "source": "python",
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

    if supplier_col and category_col and amount_col and len({supplier_col, category_col, amount_col}) == 3:
        matrix_values = combined[[supplier_col, category_col, amount_col]].copy()
        matrix_values[supplier_col] = matrix_values[supplier_col].astype(str).str.strip()
        matrix_values[category_col] = matrix_values[category_col].astype(str).str.strip()
        matrix_values[amount_col] = _to_numeric(matrix_values[amount_col])
        matrix_values = matrix_values.dropna(subset=[supplier_col, category_col, amount_col])
        if not matrix_values.empty:
            pivot = (
                matrix_values.groupby([supplier_col, category_col])[amount_col]
                .sum()
                .sort_values(ascending=False)
                .head(12)
            )
            rows = [
                {
                    "Proveedor": str((index if isinstance(index, tuple) else (index, ""))[0]),
                    "Categoria": str((index if isinstance(index, tuple) else ("", index))[1]),
                    "Monto": _format_number(float(value)),
                }
                for index, value in pivot.items()
            ]
            tables.append(
                {
                    "title": "Matriz de concentracion proveedor-categoria",
                    "description": "Cruce de proveedores y categorias con mayor monto detectado.",
                    "source": "python",
                    "columns": ["Proveedor", "Categoria", "Monto"],
                    "rows": rows,
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
                    "data_source": "python_calculated",
                    "confidence": "medium",
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
                "data_source": "python_calculated",
                "confidence": "medium",
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

    candidates = _candidate_fields(detected_columns)
    possible_analyses, not_possible_analyses = _analysis_capabilities(candidates)
    deterministic_kpis, deterministic_charts, deterministic_tables, deterministic_insights, deterministic_warnings = _deterministic_procurement_outputs(combined, candidates)
    kpis.extend(deterministic_kpis)
    charts.extend(deterministic_charts)
    tables.extend(deterministic_tables)
    insights.extend(deterministic_insights)
    warnings.extend(deterministic_warnings)
    enriched_charts = [_with_chart_presentation(chart) for chart in charts]

    profile = {
        "files_processed": len(files),
        "rows_detected": total_rows,
        "columns_detected": len(detected_columns),
        "detected_columns": detected_columns[:80],
        "date_columns": date_columns,
        "numeric_columns": numeric_columns,
        "category_columns": category_columns,
        "data_quality_warnings": list(dict.fromkeys(warnings))[:36],
        "files": source_files,
        "columns": _column_profiles(combined),
        "candidateFields": candidates,
        "rowSamples": _row_samples(combined),
        "basicStats": _basic_stats(combined, numeric_columns, date_columns, category_columns),
        "possibleAnalyses": possible_analyses,
        "notPossibleAnalyses": not_possible_analyses,
    }
    understanding = _build_data_understanding(
        source_files=source_files,
        rows_detected=total_rows,
        detected_columns=detected_columns,
        numeric_columns=numeric_columns,
        date_columns=date_columns,
        category_columns=category_columns,
        document_summaries=document_summaries,
    )
    profile["confidence"] = understanding.get("confidence_level", "medium")

    return {
        "profile": profile,
        **understanding,
        "kpis": kpis[:24],
        "charts": enriched_charts[:16],
        "tables": tables[:12],
        "insights": insights[:12],
        "document_summaries": document_summaries,
        "source_files": source_files,
        "suggested_title": suggested_title,
        "suggested_filters": [column for column in [date_col, supplier_col, category_col, status_col] if column],
    }
