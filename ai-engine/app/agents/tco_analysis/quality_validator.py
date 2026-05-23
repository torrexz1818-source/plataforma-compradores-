from __future__ import annotations

from typing import Any

from fastapi import HTTPException


REQUIRED_FIELDS = {
    "title": "Nombre del análisis",
    "item_name": "Producto, equipo o servicio",
    "analysis_type": "Tipo de análisis",
    "evaluation_horizon": "Horizonte de evaluación",
    "comparison_unit": "Unidad de comparación",
    "currency": "Moneda base",
}


def validate_required_fields(values: dict[str, str]) -> None:
    missing = [label for key, label in REQUIRED_FIELDS.items() if not values.get(key, "").strip()]
    if missing:
        raise HTTPException(status_code=400, detail=f"Completa los campos obligatorios: {', '.join(missing)}.")


def validate_alternatives(alternatives: Any) -> list[dict[str, Any]]:
    if not isinstance(alternatives, list):
        raise HTTPException(status_code=400, detail="alternatives_json debe ser una lista JSON.")
    if len(alternatives) < 1:
        raise HTTPException(status_code=400, detail="Ingresa al menos una alternativa o sube documentos para analizar.")
    if len(alternatives) > 5:
        raise HTTPException(status_code=400, detail="Puedes comparar hasta 5 alternativas en esta fase.")

    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(alternatives):
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail=f"La alternativa {index + 1} no tiene formato válido.")
        supplier_name = str(item.get("supplier_name") or item.get("name") or "").strip()
        if not supplier_name:
            raise HTTPException(status_code=400, detail=f"Ingresa nombre del proveedor en la alternativa {index + 1}.")
        normalized.append({**item, "supplier_name": supplier_name})

    return normalized
