from typing import Any


def _clamp_score(value: Any) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0

    return max(0, min(100, score))


def _clamp_rating(value: Any) -> float:
    try:
        rating = float(value)
    except (TypeError, ValueError):
        return 1

    return max(1, min(5, rating))


def _round_weight(value: float) -> float:
    return round(value, 2)


def _supplier_names(result: dict[str, Any]) -> list[str]:
    suppliers = result.get("suppliers")
    if isinstance(suppliers, list):
        names = [
            supplier.get("supplier_name")
            for supplier in suppliers
            if isinstance(supplier, dict) and supplier.get("supplier_name")
        ]
        if names:
            return [str(name) for name in names]

    ranking = result.get("ranking")
    if isinstance(ranking, list):
        names = [
            item.get("supplier_name")
            for item in ranking
            if isinstance(item, dict) and item.get("supplier_name")
        ]
        if names:
            return [str(name) for name in names]

    return []


def _normalize_matrix_weights(criteria: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not criteria:
        return criteria

    weights = []
    for item in criteria:
        try:
            weights.append(float(item.get("weight_percent", 0)))
        except (TypeError, ValueError):
            weights.append(0)

    total = sum(weight for weight in weights if weight > 0)
    if total <= 0:
        even_weight = 100 / len(criteria)
        for item in criteria:
            item["weight_percent"] = _round_weight(even_weight)
    else:
        for item, weight in zip(criteria, weights):
            item["weight_percent"] = _round_weight(max(0, weight) * 100 / total)

    difference = _round_weight(100 - sum(float(item["weight_percent"]) for item in criteria))
    criteria[-1]["weight_percent"] = _round_weight(float(criteria[-1]["weight_percent"]) + difference)
    return criteria


def _fallback_matrix_from_ranking(result: dict[str, Any], suppliers: list[str]) -> dict[str, Any]:
    ranking_scores = {
        item.get("supplier_name"): _clamp_score(item.get("score")) / 20
        for item in result.get("ranking", [])
        if isinstance(item, dict)
    }
    ratings = {
        supplier: round(_clamp_rating(ranking_scores.get(supplier, 3)), 2)
        for supplier in suppliers
    }

    return {
        "title": "Matriz de evaluación comparativa de proveedores",
        "weight_sum": 100,
        "criteria": [
            {
                "number": 1,
                "criterion": "Evaluación integral técnico-comercial y de riesgo",
                "weight_percent": 100,
                "ratings": ratings,
                "observations": (
                    "Criterio integral generado como respaldo porque la respuesta no incluyó "
                    "una matriz detallada."
                ),
            }
        ],
        "weighted_totals": [],
    }


def normalize_evaluation_matrix(result: dict[str, Any]) -> dict[str, Any]:
    suppliers = _supplier_names(result)
    matrix = result.get("evaluation_matrix")

    if not isinstance(matrix, dict):
        matrix = {}

    criteria = matrix.get("criteria")
    if not isinstance(criteria, list) or not criteria:
        matrix = _fallback_matrix_from_ranking(result, suppliers)
        criteria = matrix["criteria"]

    normalized_criteria: list[dict[str, Any]] = []
    for index, item in enumerate(criteria, start=1):
        if not isinstance(item, dict):
            continue

        ratings = item.get("ratings")
        if not isinstance(ratings, dict):
            ratings = {}

        normalized_ratings = {
            supplier: _clamp_rating(ratings.get(supplier, 1))
            for supplier in suppliers
        }

        normalized_criteria.append(
            {
                "number": int(item.get("number") or index),
                "criterion": str(item.get("criterion") or f"Criterio {index}"),
                "weight_percent": item.get("weight_percent", 0),
                "ratings": normalized_ratings,
                "observations": str(item.get("observations") or "No especificado"),
            }
        )

    normalized_criteria = _normalize_matrix_weights(normalized_criteria)

    totals = []
    for supplier in suppliers:
        weighted_score = sum(
            float(item["ratings"].get(supplier, 1)) * float(item["weight_percent"]) / 100
            for item in normalized_criteria
        )
        totals.append(
            {
                "supplier_name": supplier,
                "weighted_score": round(max(1, min(5, weighted_score)), 2),
                "ranking_position": 0,
            }
        )

    totals.sort(key=lambda item: item["weighted_score"], reverse=True)
    for index, item in enumerate(totals, start=1):
        item["ranking_position"] = index

    result["evaluation_matrix"] = {
        "title": str(matrix.get("title") or "Matriz de evaluación comparativa de proveedores"),
        "weight_sum": round(sum(float(item["weight_percent"]) for item in normalized_criteria), 2),
        "criteria": normalized_criteria,
        "weighted_totals": totals,
    }

    guide = result.get("criteria_guide")
    if not isinstance(guide, list):
        guide = []

    guide_by_criterion = {
        item.get("criterion"): item for item in guide if isinstance(item, dict)
    }
    result["criteria_guide"] = [
        {
            "number": item["number"],
            "criterion": item["criterion"],
            "weight_percent": item["weight_percent"],
            "evaluation_scale_description": str(
                guide_by_criterion.get(item["criterion"], {}).get(
                    "evaluation_scale_description",
                    "5 = Excelente cumplimiento | 4 = Bueno | 3 = Aceptable | 2 = Deficiente | 1 = Muy deficiente o no especificado",
                )
            ),
            "verification_source": str(
                guide_by_criterion.get(item["criterion"], {}).get(
                    "verification_source",
                    "Propuesta comercial / documentación del proveedor",
                )
            ),
        }
        for item in normalized_criteria
    ]

    return result


def normalize_ranking(result: dict[str, Any]) -> dict[str, Any]:
    result = normalize_evaluation_matrix(result)
    totals = {
        item["supplier_name"]: item
        for item in result.get("evaluation_matrix", {}).get("weighted_totals", [])
        if isinstance(item, dict)
    }

    ranking = result.get("ranking")
    if not isinstance(ranking, list):
        ranking = []

    ranking_by_supplier = {
        item.get("supplier_name"): item for item in ranking if isinstance(item, dict)
    }

    normalized = []
    for supplier_name, total in totals.items():
        source = ranking_by_supplier.get(supplier_name, {})
        weighted_score = float(total.get("weighted_score", 1))
        normalized.append(
            {
                "position": int(total.get("ranking_position") or 0),
                "supplier_name": supplier_name,
                "score": _clamp_score(source.get("score", weighted_score * 20)),
                "weighted_score": weighted_score,
                "reason": str(source.get("reason") or "Ranking calculado con la matriz ponderada."),
                "main_strengths": source.get("main_strengths") if isinstance(source.get("main_strengths"), list) else [],
                "main_risks": source.get("main_risks") if isinstance(source.get("main_risks"), list) else [],
            }
        )

    normalized.sort(key=lambda item: item.get("weighted_score", 0), reverse=True)
    for index, item in enumerate(normalized, start=1):
        item["position"] = index

    result["ranking"] = normalized
    if normalized:
        result["recommended_supplier"] = normalized[0].get("supplier_name", "No especificado")

    result.setdefault(
        "auto_generated_criteria_note",
        "Los criterios y pesos fueron generados automáticamente por IA según el tipo de compra/servicio y la información contenida en las propuestas.",
    )
    result.setdefault(
        "evaluation_scale",
        {
            "min": 1,
            "max": 5,
            "labels": {
                "1": "Muy deficiente",
                "2": "Deficiente",
                "3": "Aceptable",
                "4": "Bueno",
                "5": "Excelente",
            },
            "weighted_score_formula": "Puntaje ponderado = Valoración × Peso",
        },
    )

    return result
