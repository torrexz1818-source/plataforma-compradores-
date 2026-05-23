from __future__ import annotations

import re
from typing import Any

TCO_COST_FIELDS = {
    "Precio de adquisición": ["base_price", "acquisition_cost", "purchase_price"],
    "Flete internacional": ["international_freight", "freight_cost"],
    "Seguro internacional": ["international_insurance", "insurance_cost"],
    "Aduanas / impuestos": ["customs_taxes", "taxes", "duties_taxes"],
    "Aranceles": ["tariffs", "duties"],
    "Agente de aduana": ["customs_agent_cost"],
    "Handling / almacenaje / descarga": ["handling_cost", "storage_cost", "unloading_cost"],
    "Transporte interno": ["internal_transport_cost", "transport_cost"],
    "Instalación / implementación": ["installation_cost", "implementation_cost"],
    "Capacitación": ["training_cost"],
    "Mantenimiento preventivo": ["preventive_maintenance_cost", "annual_maintenance_cost"],
    "Mantenimiento correctivo": ["corrective_maintenance_cost"],
    "Operación": ["operation_cost", "annual_operation_cost"],
    "Energía / combustible / insumos": ["energy_cost", "annual_energy_cost", "fuel_cost", "supplies_cost"],
    "Repuestos": ["spare_parts_cost"],
    "Soporte": ["support_cost"],
    "Seguros": ["asset_insurance_cost"],
    "Costos administrativos": ["administrative_cost"],
    "Costos financieros": ["financial_cost"],
    "Costos de salida o reemplazo": ["exit_cost", "replacement_cost"],
    "Costo esperado de riesgo": ["expected_risk_cost", "risk_cost"],
    "Otros costos": ["other_costs"],
    "Valor residual o recuperable": ["residual_value", "recoverable_value"],
}

RECURRING_FIELDS = {
    "annual_maintenance_cost",
    "annual_operation_cost",
    "annual_energy_cost",
}


def normalize_number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        return float(value)
    if not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None

    cleaned = re.sub(r"[^\d,.\-]", "", text)
    if not cleaned or cleaned in {"-", ".", ","}:
        return None

    if "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        cleaned = cleaned.replace(",", ".")

    try:
        return float(cleaned)
    except ValueError:
        return None


def infer_years(evaluation_horizon: str) -> float | None:
    text = evaluation_horizon.lower()
    if "mensual" in text or "mes" in text:
        return 1 / 12
    if "anual" in text or "año" in text:
        return 1
    match = re.search(r"(\d+(?:[.,]\d+)?)\s*a", text)
    if match:
        return normalize_number(match.group(1))
    return None


def _value_for_component(alternative: dict[str, Any], fields: list[str], years: float | None) -> float | None:
    total = 0.0
    found = False
    for field in fields:
        value = normalize_number(alternative.get(field))
        if value is None:
            continue
        found = True
        if years and field in RECURRING_FIELDS:
            value *= years
        total += value
    return total if found else None


def calculate_tco(
    alternatives: list[dict[str, Any]],
    evaluation_horizon: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    warnings: list[str] = []
    years = infer_years(evaluation_horizon)
    names = [str(item.get("supplier_name") or item.get("name") or f"Alternativa {idx + 1}") for idx, item in enumerate(alternatives)]
    matrix: list[dict[str, Any]] = []
    totals: list[dict[str, Any]] = []

    for component, fields in TCO_COST_FIELDS.items():
        values: dict[str, float | None] = {}
        for name, alternative in zip(names, alternatives):
            values[name] = _value_for_component(alternative, fields, years)
        if any(value is not None for value in values.values()):
            matrix.append(
                {
                    "cost_component": component,
                    "values": values,
                    "notes": "Valor anualizado por horizonte cuando el dato fue entregado como costo anual."
                    if any(field in RECURRING_FIELDS for field in fields)
                    else "",
                }
            )

    for name, alternative in zip(names, alternatives):
        initial_price = normalize_number(alternative.get("base_price") or alternative.get("acquisition_cost"))
        residual = _value_for_component(alternative, TCO_COST_FIELDS["Valor residual o recuperable"], years) or 0
        subtotal = 0.0
        found_any_cost = False
        hidden_costs: list[str] = []

        for component, fields in TCO_COST_FIELDS.items():
            value = _value_for_component(alternative, fields, years)
            if value is None:
                continue
            found_any_cost = True
            if component == "Valor residual o recuperable":
                continue
            subtotal += value
            if component != "Precio de adquisición" and value > 0:
                hidden_costs.append(component)

        total_tco = subtotal - residual if found_any_cost else None
        if total_tco is not None and total_tco < 0:
            warnings.append(f"{name}: el TCO calculado es negativo; revisar valor residual o datos de costos.")

        quantity = normalize_number(alternative.get("quantity"))
        tco_per_unit = total_tco / quantity if total_tco is not None and quantity and quantity > 0 else total_tco
        tco_annual = total_tco / years if total_tco is not None and years and years > 0 else None
        tco_monthly = tco_annual / 12 if tco_annual is not None else None

        risk_text = " ".join(
            str(alternative.get(field) or "")
            for field in ["known_risks", "risk_observations", "quality_risk", "logistics_risk", "regulatory_risk"]
        ).lower()
        risk_level = "high" if any(word in risk_text for word in ["alto", "high", "critico", "crítico"]) else "medium" if risk_text else "low"

        totals.append(
            {
                "alternative": name,
                "initial_price": initial_price,
                "total_tco": total_tco,
                "tco_per_unit": tco_per_unit,
                "tco_monthly": tco_monthly,
                "tco_annual": tco_annual,
                "risk_level": risk_level,
                "main_hidden_costs": hidden_costs[:8],
            }
        )

    ranked = sorted(
        [item for item in totals if item["total_tco"] is not None],
        key=lambda item: item["total_tco"],
    )
    ranking = [
        {
            "position": index + 1,
            "alternative": item["alternative"],
            "ranking_type": "Menor TCO",
            "total_tco": item["total_tco"],
            "reason": "Ranking calculado en Python con los costos numéricos entregados por el comprador.",
        }
        for index, item in enumerate(ranked)
    ]

    if len(ranking) < 2:
        warnings.append("No hay suficientes montos numéricos para calcular un ranking TCO completo en Python.")

    return matrix, totals, ranking, warnings


def merge_calculations(result: dict[str, Any], alternatives: list[dict[str, Any]], evaluation_horizon: str) -> dict[str, Any]:
    matrix, totals, ranking, warnings = calculate_tco(alternatives, evaluation_horizon)

    if matrix:
        result["tco_matrix"] = matrix
    if totals:
        result["tco_totals"] = totals
    if ranking:
        result["ranking"] = ranking

    existing_warnings = result.get("calculation_warnings")
    if not isinstance(existing_warnings, list):
        existing_warnings = []
    result["calculation_warnings"] = [*existing_warnings, *warnings]
    return result
