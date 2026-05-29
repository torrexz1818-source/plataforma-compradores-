from __future__ import annotations

import warnings
from pathlib import Path
from typing import Any

import pandas as pd

from app.agents.dashboard_creator.chart_recommender import recommend_chart_type
from app.document_processing.file_detector import detect_file_type
from app.document_processing.structured_document import build_structured_document_payload

AMOUNT_HINTS = ("monto", "importe", "total", "precio", "gasto", "valor", "subtotal", "pagado", "ahorro", "amount", "price", "cost")
AMOUNT_PRIORITY_HINTS = (
    "monto oc final",
    "monto oc original",
    "total_pen",
    "monto_pen",
    "monto_usd",
    "subtotal_pen",
    "monto pagado",
    "ahorro pen",
    "ahorro negociado",
    "precio referencia",
)
NON_AMOUNT_HINTS = (
    "centro costo",
    "centro de costo",
    "codigo cc",
    "código cc",
    "departamento",
    "proyecto",
    "id",
    "ruc",
    "estado",
)
SUPPLIER_HINTS = ("proveedor", "supplier", "vendor", "empresa", "razon", "cliente")
CATEGORY_HINTS = ("categoria", "category", "rubro", "familia", "tipo", "linea", "producto", "servicio", "centro costo", "centro de costo", "religion", "religión")
DATE_HINTS = ("fecha", "date", "periodo", "mes", "month", "year", "ano")
DATE_PRIORITY_HINTS = (
    "f. solicitud",
    "f. creacion oc",
    "f. creación oc",
    "f. aprobacion",
    "f. aprobación",
    "f. entrega esperada",
    "f. entrega real",
    "f. pago",
    "fecha_solicitud",
    "fecha_oc",
    "fecha_aprobacion",
    "fecha_entrega",
    "fecha_pago",
)
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
PROMISED_DATE_HINTS = ("fecha prometida", "fecha compromiso", "fecha esperada", "entrega esperada", "f. entrega esperada", "prometida", "promised")
ACTUAL_DATE_HINTS = ("fecha real", "fecha entrega", "entrega real", "f. entrega real", "entregado", "actual")
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
BUYER_HINTS = ("comprador", "buyer", "responsable", "solicitante", "usuario compra")
ORDER_STATUS_HINTS = ("estado oc", "estado_oc", "estado orden", "estado orden compra")
NUMERIC_EXCLUDE_HINTS = ("telefono", "teléfono", "celular", "dni", "ruc", "documento", "edad", "centro costo", "centro de costo", "codigo cc", "código cc")
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
BUSINESS_SHEET_PRIORITY = (
    "oc_maestro",
    "resumen_mensual",
    "compradores_kpi",
    "categorias_kpi",
    "condiciones_pago",
    "t_transacciones",
    "t_proveedores",
    "t_categorias",
)

FOCUS_KEYWORDS = {
    "categorias": ("category", "categoria", "categor"),
    "proveedores": ("supplier", "proveedor"),
    "ahorro": ("savings", "ahorro"),
    "cumplimiento": ("compliance", "otif", "estado", "cumpl"),
    "compradores": ("buyer", "comprador"),
    "pagos": ("payment", "pago", "condicion"),
}
FIELD_HINTS = {
    "proveedor": SUPPLIER_HINTS,
    "categoria": CATEGORY_HINTS,
    "producto": PRODUCT_HINTS,
    "servicio": SERVICE_HINTS,
    "monto": AMOUNT_HINTS,
    "moneda": CURRENCY_HINTS,
    "fecha": DATE_HINTS + DATE_PRIORITY_HINTS,
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
    "comprador": BUYER_HINTS,
    "estado_oc": ORDER_STATUS_HINTS,
}


def _user_text(user_context: dict[str, Any] | None) -> str:
    if not user_context:
        return ""
    return " ".join(str(value or "") for value in user_context.values()).lower()


def _sheet_rank(sheet_name: str, user_context: dict[str, Any] | None = None) -> int:
    normalized = _normalize_column_name(sheet_name)
    requested = _user_text(user_context)
    if normalized and normalized in _normalize_column_name(requested):
        return -2
    for index, name in enumerate(BUSINESS_SHEET_PRIORITY):
        if name in normalized:
            return index
    return len(BUSINESS_SHEET_PRIORITY) + 1


def _read_table(path: Path, file_type: str, user_context: dict[str, Any] | None = None) -> pd.DataFrame | None:
    if file_type == "csv":
        try:
            return pd.read_csv(path)
        except UnicodeDecodeError:
            return pd.read_csv(path, encoding="latin-1")
        except pd.errors.ParserError:
            return pd.read_csv(path, sep=None, engine="python")
    if file_type == "xlsx":
        workbook = pd.read_excel(path, sheet_name=None, header=None)
        prepared: list[tuple[int, str, pd.DataFrame]] = []
        for sheet_name, frame in workbook.items():
            if frame.empty:
                continue
            cleaned = _clean_frame(frame.copy())
            if cleaned.empty:
                continue
            cleaned["__sheet"] = sheet_name
            prepared.append((_sheet_rank(str(sheet_name), user_context), str(sheet_name), cleaned))
        if not prepared:
            return None
        selected = sorted(prepared, key=lambda item: (item[0], item[1].lower()))
        return pd.concat([frame for _, _, frame in selected], ignore_index=True, sort=False)
    return None


def _excel_sheet_names(path: Path, file_type: str) -> list[str]:
    if file_type != "xlsx":
        return []
    try:
        return [str(sheet) for sheet in pd.ExcelFile(path).sheet_names]
    except Exception:
        return []


def _excel_sheet_profiles(path: Path, file_type: str) -> list[dict[str, Any]]:
    if file_type != "xlsx":
        return []
    try:
        workbook = pd.read_excel(path, sheet_name=None, header=None)
    except Exception:
        return []
    profiles: list[dict[str, Any]] = []
    for sheet_name, frame in workbook.items():
        cleaned = _clean_frame(frame.copy())
        columns = [str(column) for column in cleaned.columns if not str(column).startswith("__")]
        profiles.append(
            {
                "sheetName": str(sheet_name),
                "rowsDetected": int(len(cleaned.index)),
                "columnsDetected": columns[:80],
                "columnsCount": len(columns),
            }
        )
    return profiles


def _header_score(row: pd.Series) -> int:
    text = " ".join(str(value).strip().lower() for value in row.dropna().tolist())
    hints = (
        "fecha",
        "pago",
        "monto",
        "monto_usd",
        "monto_pen",
        "total_pen",
        "subtotal_pen",
        "fecha_solicitud",
        "estado_oc",
        "nombre",
        "proveedor",
        "comprador",
        "categoria",
        "orden",
        "oc",
    )
    non_empty = row.dropna().astype(str).str.strip()
    generic_penalty = sum(1 for value in non_empty if str(value).strip().lower().startswith("columna"))
    return sum(2 for hint in hints if hint in text) + min(len(non_empty), 8) - generic_penalty


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
    if _header_score(pd.Series(list(frame.columns))) >= 9:
        return frame
    unnamed_ratio = sum(column.startswith("unnamed") for column in raw_columns) / max(len(raw_columns), 1)
    candidate_rows = frame.head(10)
    best_index = None
    best_score = 0

    for index, row in candidate_rows.iterrows():
        score = _header_score(row)
        if score > best_score:
            best_score = score
            best_index = index

    if best_index is None or (unnamed_ratio < 0.45 and best_score < 9):
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


def _has_date_hint(column: str) -> bool:
    lower = str(column).lower()
    return any(hint in lower for hint in DATE_HINTS + DATE_PRIORITY_HINTS)


def _valid_dates(values: pd.Series, column: str) -> pd.Series:
    if not _has_date_hint(column):
        sample = values.dropna().astype(str).head(20)
        if sample.empty or not sample.str.contains(r"[/\-.]|20\d{2}|19\d{2}", regex=True).any():
            return pd.Series(pd.NaT, index=values.index)
    parsed = _parse_dates_quiet(values)
    valid = parsed.notna()
    if not valid.any():
        return parsed
    plausible = parsed.dt.year.between(1990, 2100)
    if (valid & plausible).mean() < 0.55:
        return pd.Series(pd.NaT, index=values.index)
    return parsed.where(plausible)


def _is_non_amount_column(column: str | None) -> bool:
    if not column:
        return True
    lower = str(column).strip().lower()
    if any(hint in lower for hint in NON_AMOUNT_HINTS):
        return True
    if lower.startswith("cc") or lower.startswith("id"):
        return True
    return False


def _looks_like_cost_center(values: pd.Series) -> bool:
    sample = values.dropna().astype(str).str.strip().head(40)
    if sample.empty:
        return False
    return sample.str.match(r"^(cc[-_\s]?\d+|\d{2,6}[-_/]\d{1,6})$", case=False).mean() >= 0.5


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
        parsed_dates = _valid_dates(values, column)
        date_ratio = parsed_dates.notna().mean()

        has_numeric_hint = any(hint in lower for hint in AMOUNT_HINTS + QUANTITY_HINTS)
        is_excluded_numeric = any(hint in lower for hint in NUMERIC_EXCLUDE_HINTS) or _looks_like_cost_center(values)
        is_generic_numeric = lower.startswith("columna") or lower.startswith("column") or lower.startswith("unnamed")

        if has_numeric_hint and not is_excluded_numeric and not _is_non_amount_column(column):
            numeric_columns.append(column)
        elif numeric_likeness >= 0.65 and not is_excluded_numeric and not is_generic_numeric:
            numeric_columns.append(column)
        elif date_ratio >= 0.55 or _has_date_hint(column):
            date_columns.append(column)
        elif values.nunique(dropna=True) <= max(35, len(values) * 0.72):
            category_columns.append(column)

    return numeric_columns, date_columns, category_columns


def _best_column(columns: list[str], hints: tuple[str, ...]) -> str | None:
    if hints == DATE_HINTS:
        priority = _hint_column(columns, DATE_PRIORITY_HINTS)
        if priority:
            return priority
    for column in columns:
        lower = column.lower()
        if any(hint in lower for hint in hints):
            return column
    return columns[0] if columns else None


def _requested_column(columns: list[str], user_context: dict[str, Any] | None, hints: tuple[str, ...] = ()) -> str | None:
    haystack = _normalize_column_name(_user_text(user_context))
    if not haystack:
        return None
    exact_matches = [column for column in columns if _normalize_column_name(column) and _normalize_column_name(column) in haystack]
    if hints:
        exact_matches = [column for column in exact_matches if any(hint in column.lower() for hint in hints)]
    return exact_matches[0] if exact_matches else None


def _is_generic_column(column: str | None) -> bool:
    if not column:
        return True
    lower = column.strip().lower()
    return lower.startswith("columna") or lower.startswith("column") or lower.startswith("unnamed")


def _best_amount_column(columns: list[str], user_context: dict[str, Any] | None = None) -> str | None:
    usable = [column for column in columns if not _is_non_amount_column(column)]
    requested = _requested_column(usable, user_context, AMOUNT_HINTS + AMOUNT_PRIORITY_HINTS)
    if requested and not _is_generic_column(requested):
        return requested
    priority = _hint_column(usable, AMOUNT_PRIORITY_HINTS)
    if priority and not _is_generic_column(priority):
        return priority
    hinted = _hint_column(usable, AMOUNT_HINTS)
    if hinted and not _is_generic_column(hinted) and not _is_non_amount_column(hinted):
        return hinted
    return None


def _hint_column(columns: list[str], hints: tuple[str, ...]) -> str | None:
    for hint in hints:
        for column in columns:
            if hint in column.lower():
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
    if _valid_dates(values, str(series.name or "")).notna().mean() >= 0.55:
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
        if field == "monto":
            matches = [column for column in matches if not _is_non_amount_column(column)]
            priority = _hint_column(matches, AMOUNT_PRIORITY_HINTS)
            if priority:
                matches = [priority] + [column for column in matches if column != priority]
        if field == "fecha":
            priority = _hint_column(matches, DATE_PRIORITY_HINTS)
            if priority:
                matches = [priority] + [column for column in matches if column != priority]
        if field == "orden_compra":
            matches = [column for column in matches if "estado" not in column.lower() and not any(hint in column.lower() for hint in AMOUNT_HINTS)]
            priority = _hint_column(matches, ("orden compra", "orden de compra", "oc numero", "numero oc", "nro oc"))
            if priority:
                matches = [priority] + [column for column in matches if column != priority]
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
        parsed = _valid_dates(frame[column], column).dropna() if column in frame else pd.Series(dtype="datetime64[ns]")
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
    start_dates = _valid_dates(start, str(start.name or "fecha"))
    end_dates = _valid_dates(end, str(end.name or "fecha"))
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


def _should_exclude_cancelled(user_context: dict[str, Any] | None) -> bool:
    text = _user_text(user_context)
    return "cancelad" in text and any(token in text for token in ("no considerar", "excluir", "sin ", "no incluir", "no tomar"))


def _requested_currency(user_context: dict[str, Any] | None) -> str | None:
    text = _user_text(user_context)
    if "solo moneda usd" in text or "moneda principal es usd" in text or " usd" in f" {text}":
        return "USD"
    if "solo moneda pen" in text or "moneda principal es pen" in text or " pen" in f" {text}":
        return "PEN"
    return None


def _requested_years(user_context: dict[str, Any] | None) -> list[int]:
    import re

    if not user_context:
        return []
    searchable = " ".join(
        str(user_context.get(key) or "")
        for key in ("period", "objective_instructions", "additional_context", "data_type", "visualization_focus")
    ).lower()
    years = [int(match) for match in re.findall(r"\b(20\d{2}|19\d{2})\b", searchable)]
    return sorted(set(years))


def _apply_user_filters(frame: pd.DataFrame, candidates: dict[str, list[str]], user_context: dict[str, Any] | None) -> tuple[pd.DataFrame, list[str]]:
    filtered = frame.copy()
    notes: list[str] = []
    if filtered.empty:
        return filtered, notes
    status_col = _candidate_col(candidates, "estado_oc", "estado_cumplimiento")
    if status_col and status_col in filtered and _should_exclude_cancelled(user_context):
        before = len(filtered)
        filtered = filtered[~filtered[status_col].astype(str).str.lower().str.contains("cancelad", na=False)].copy()
        if before != len(filtered):
            notes.append(f"Se excluyeron ordenes canceladas segun instruccion del usuario: {before - len(filtered)} registros.")
    currency = _requested_currency(user_context)
    currency_col = _candidate_col(candidates, "moneda")
    if currency and currency_col and currency_col in filtered:
        before = len(filtered)
        filtered = filtered[filtered[currency_col].astype(str).str.upper().str.contains(currency, na=False)].copy()
        if before != len(filtered):
            notes.append(f"Se filtro moneda {currency} segun instruccion del usuario: {len(filtered)} de {before} registros.")
    years = _requested_years(user_context)
    date_col = _candidate_col(candidates, "fecha", "fecha_prometida", "fecha_real")
    if years and date_col and date_col in filtered:
        parsed = _valid_dates(filtered[date_col], date_col)
        if not parsed.notna().any():
            notes.append("No se aplico filtro de periodo porque la columna de fecha no fue suficientemente confiable.")
            return filtered, notes
        before = len(filtered)
        candidate = filtered[parsed.dt.year.isin(years).fillna(False)].copy()
        if candidate.empty:
            notes.append(f"No se aplico filtro de periodo ({', '.join(map(str, years))}) porque dejaba el dataset sin registros.")
        elif before != len(candidate):
            filtered = candidate
            notes.append(f"Se filtro el periodo solicitado ({', '.join(map(str, years))}): {len(filtered)} de {before} registros.")
    return filtered, notes


def _focus_tokens(user_context: dict[str, Any] | None) -> tuple[str, ...]:
    text = _user_text(user_context)
    focus = _normalize_column_name(str((user_context or {}).get("visualization_focus") or ""))
    tokens: list[str] = []
    for key, values in FOCUS_KEYWORDS.items():
        if key in focus or key in text or any(value in text for value in values):
            tokens.extend(values)
    return tuple(dict.fromkeys(tokens))


def _priority_score(item: dict[str, Any], focus_tokens: tuple[str, ...]) -> int:
    text = " ".join(str(item.get(key, "")) for key in ("title", "description", "chart_id", "x_axis", "y_axis")).lower()
    return sum(1 for token in focus_tokens if token in text)


def _prioritize_outputs(items: list[dict[str, Any]], user_context: dict[str, Any] | None) -> list[dict[str, Any]]:
    tokens = _focus_tokens(user_context)
    if not tokens:
        return items
    return sorted(items, key=lambda item: _priority_score(item, tokens), reverse=True)


def _deterministic_procurement_outputs(
    frame: pd.DataFrame,
    candidates: dict[str, list[str]],
    user_context: dict[str, Any] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    kpis: list[dict[str, Any]] = []
    charts: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    insights: list[dict[str, Any]] = []
    warnings: list[str] = []
    if frame.empty:
        return kpis, charts, tables, insights, warnings

    frame, filter_notes = _apply_user_filters(frame, candidates, user_context)
    warnings.extend(filter_notes)
    if frame.empty:
        warnings.append("Los filtros solicitados por el usuario dejaron el dataset sin registros disponibles.")
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
    buyer_col = _candidate_col(candidates, "comprador")
    po_col = _candidate_col(candidates, "orden_compra")
    request_col = _candidate_col(candidates, "solicitud", "requerimiento")

    if po_col:
        orders = _clean_text_series(frame[po_col])
        if not orders.empty:
            _append_kpi(kpis, "Total de ordenes", str(int(orders.nunique())), f"Ordenes de compra distintas detectadas en {po_col}.", f"COUNT DISTINCT({po_col})", confidence="medium")

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
            if buyer_col:
                savings_frame = frame[[buyer_col]].copy()
                savings_frame["__savings"] = base - negotiated
                savings_rows = _top_group(savings_frame, buyer_col, "__savings", limit=10)
                _add_chart(charts, "savings_by_buyer", "Ahorro por comprador", "horizontal_bar", "Ahorro calculado agrupado por comprador o responsable.", savings_rows, "Permite ubicar responsables con mayor ahorro calculado.", x_axis=buyer_col, y_axis="Ahorro", confidence="medium")
    elif savings_col:
        declared = _to_numeric(frame[savings_col]).dropna()
        if not declared.empty:
            _append_kpi(kpis, "Ahorro declarado", _format_number(float(declared.sum())), f"Suma de la columna {savings_col}; validar criterio de origen.", f"SUM({savings_col})", confidence="medium", unit="monto", status="positive")
            if buyer_col:
                savings_by_buyer = _top_group(frame, buyer_col, savings_col, limit=10)
                _add_chart(charts, "savings_by_buyer", "Ahorro por comprador", "horizontal_bar", "Ahorro agrupado por comprador o responsable.", savings_by_buyer, "Permite ubicar responsables con mayor ahorro declarado.", x_axis=buyer_col, y_axis=savings_col, confidence="medium")
    else:
        warnings.append("No se calculo ahorro porque faltan precio base/anterior/presupuesto y precio negociado, o una columna de ahorro declarada.")

    if buyer_col and amount_col:
        buyer_rows = _top_group(frame, buyer_col, amount_col, limit=10)
        _add_chart(charts, "spend_by_buyer", "Compras por comprador", "horizontal_bar", "Monto agrupado por comprador o responsable.", buyer_rows, "Ayuda a comparar concentracion de compras por responsable.", x_axis=buyer_col, y_axis=amount_col, confidence="medium")

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
        promised = _valid_dates(frame[promised_date_col], promised_date_col)
        actual = _valid_dates(frame[actual_date_col], actual_date_col)
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

    if promised_date_col and actual_date_col:
        promised = _valid_dates(frame[promised_date_col], promised_date_col)
        actual = _valid_dates(frame[actual_date_col], actual_date_col)
        valid_dates = promised.notna() & actual.notna()
        if valid_dates.any():
            monthly = pd.DataFrame({"period": promised[valid_dates].dt.to_period("M").astype(str), "on_time": actual[valid_dates] <= promised[valid_dates]})
            grouped = monthly.groupby("period")["on_time"].mean().sort_index().tail(12)
            _add_chart(
                charts,
                "monthly_on_time",
                "% entrega a tiempo mensual",
                "line",
                "Porcentaje de entregas realizadas en o antes de la fecha prometida.",
                [{"label": str(label), "value": round(float(value) * 100, 2)} for label, value in grouped.items()],
                "Permite revisar meses con deterioro o mejora de puntualidad.",
                x_axis=promised_date_col,
                y_axis="%",
                confidence="medium",
            )

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

    return (
        _prioritize_outputs(kpis, user_context),
        _prioritize_outputs(charts, user_context),
        _prioritize_outputs(tables, user_context),
        _prioritize_outputs(insights, user_context),
        warnings,
    )


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
    values[date_col] = _valid_dates(values[date_col], date_col)
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


def _sample_rows_for_prompt(frame: pd.DataFrame, max_rows: int = 80) -> tuple[pd.DataFrame, str]:
    if len(frame.index) <= max_rows:
        return frame.copy(), "complete_table"
    head_count = max(max_rows // 3, 1)
    tail_count = max(max_rows // 3, 1)
    middle_count = max(max_rows - head_count - tail_count, 1)
    middle_start = max((len(frame.index) // 2) - (middle_count // 2), 0)
    sampled = pd.concat(
        [
            frame.head(head_count),
            frame.iloc[middle_start : middle_start + middle_count],
            frame.tail(tail_count),
        ],
        ignore_index=True,
    )
    return sampled, "head_middle_tail_sample"


def _tabular_excerpt(frame: pd.DataFrame, max_rows: int = 80) -> str:
    visible_columns = [column for column in frame.columns if not str(column).startswith("__")]
    if not visible_columns:
        return ""
    compact, strategy = _sample_rows_for_prompt(frame[visible_columns], max_rows)
    return f"Muestra usada: {strategy}; filas totales: {len(frame.index)}\n" + compact.to_csv(index=False)[:9000]


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


def profile_files(files: list[tuple[Path, str]], user_context: dict[str, Any] | None = None) -> dict[str, Any]:
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
                "sheet_profiles": _excel_sheet_profiles(path, file_type),
                "tables_detected": 0,
            }
        )
        if file_type in {"xlsx", "csv"}:
            frame = _read_table(path, file_type, user_context)
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
            trace = build_structured_document_payload(path, filename, char_budget=8000)
            detected_type = str(trace.get("fileType") or file_type)
            file_warnings = [str(item) for item in trace.get("warnings", [])]
            compact = "\n\n".join(str(block.get("content", "")) for block in trace.get("evidenceBlocks", [])[:8])[:3500]
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
                    "llm_excerpt": compact[:1800],
                    "relevant_findings": findings,
                    "traceability": trace,
                    "limitations": file_warnings + ["Fuente secundaria: texto documental, no dataset tabular completo."],
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

    candidates = _candidate_fields(detected_columns)
    if not combined.empty:
        filtered_combined, filter_notes = _apply_user_filters(combined, candidates, user_context)
        if filter_notes:
            warnings.extend(filter_notes)
            combined = filtered_combined

    amount_col = _best_amount_column(numeric_columns, user_context) if not combined.empty else None
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

    if amount_col:
        amount_values = _to_numeric(combined[amount_col])
        valid_amounts = amount_values.dropna()
        total_amount = float(valid_amounts.sum()) if not valid_amounts.empty else 0.0
        avg_amount = float(valid_amounts.mean()) if not valid_amounts.empty else 0.0
        max_amount = float(valid_amounts.max()) if not valid_amounts.empty else 0.0
        kpis.extend(
            [
                {
                    "title": "Total comprado",
                    "value": _format_number(total_amount),
                    "description": f"Suma de la columna {amount_col}.",
                    "calculation_logic": f"SUM({amount_col})",
                    "source": "python",
                    "confidence": "high",
                },
                {
                    "title": "Compra promedio",
                    "value": _format_number(avg_amount),
                    "description": f"Promedio de la columna {amount_col}.",
                    "calculation_logic": f"AVG({amount_col})",
                    "source": "python",
                    "confidence": "high",
                },
                {
                    "title": "Orden de mayor monto",
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
                    "title": "Proveedores analizados",
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
                    "title": "Categorias analizadas",
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
        parsed_dates = _valid_dates(combined[date_col], date_col).dropna()
        if not parsed_dates.empty:
            pass
        elif total_rows:
            warnings.append("No se detecto un periodo confiable para analisis temporal.")

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

    possible_analyses, not_possible_analyses = _analysis_capabilities(candidates)
    deterministic_kpis, deterministic_charts, deterministic_tables, deterministic_insights, deterministic_warnings = _deterministic_procurement_outputs(combined, candidates, user_context)
    kpis.extend(deterministic_kpis)
    charts.extend(deterministic_charts)
    tables.extend(deterministic_tables)
    insights.extend(deterministic_insights)
    warnings.extend(deterministic_warnings)
    kpis = _prioritize_outputs(kpis, user_context)
    charts = _prioritize_outputs(charts, user_context)
    tables = _prioritize_outputs(tables, user_context)
    insights = _prioritize_outputs(insights, user_context)
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
        "userInput": user_context or {},
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
