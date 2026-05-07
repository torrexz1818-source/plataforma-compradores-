from typing import Any


def _clamp_score(value: Any) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0

    return max(0, min(100, score))


def normalize_ranking(result: dict[str, Any]) -> dict[str, Any]:
    ranking = result.get("ranking")
    if not isinstance(ranking, list):
        result["ranking"] = []
        return result

    normalized = []
    for item in ranking:
        if not isinstance(item, dict):
            continue
        item["score"] = _clamp_score(item.get("score"))
        normalized.append(item)

    normalized.sort(key=lambda item: item.get("score", 0), reverse=True)
    for index, item in enumerate(normalized, start=1):
        item["position"] = index

    result["ranking"] = normalized
    if normalized and not result.get("recommended_supplier"):
        result["recommended_supplier"] = normalized[0].get("supplier_name", "No especificado")

    return result
