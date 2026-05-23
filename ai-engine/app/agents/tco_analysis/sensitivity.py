from __future__ import annotations

from typing import Any


def build_sensitivity_from_totals(totals: list[dict[str, Any]]) -> dict[str, Any]:
    numeric_totals = [
        item for item in totals
        if isinstance(item.get("total_tco"), int | float) and item.get("alternative")
    ]

    if len(numeric_totals) < 2:
        return {
            "base": ["No hay suficientes costos numéricos para comparar escenarios."],
            "optimistic": ["Falta completar precios, operación, mantenimiento o riesgos cuantificables."],
            "pessimistic": ["Falta información para simular sobrecostos."],
            "break_even": ["No se puede calcular punto de equilibrio con los datos actuales."],
            "most_sensitive_variable": "Datos de costos incompletos",
        }

    ordered = sorted(numeric_totals, key=lambda item: item["total_tco"])
    best = ordered[0]
    second = ordered[1]
    gap = float(second["total_tco"]) - float(best["total_tco"])
    gap_percent = gap / float(best["total_tco"]) * 100 if float(best["total_tco"]) else 0

    return {
        "base": [
            f"Escenario base: {best['alternative']} tiene el menor TCO calculado.",
            f"La brecha contra la segunda alternativa es {gap:,.2f} ({gap_percent:.1f}%).",
        ],
        "optimistic": [
            "Si flete, mantenimiento o consumo bajan 10%, el ranking solo cambia si la brecha actual es menor a ese impacto.",
        ],
        "pessimistic": [
            "Si flete, mantenimiento, defectos o lead time suben 20%, revisar alternativas con mayor exposición logística u operativa.",
        ],
        "break_even": [
            f"{second['alternative']} tendría que reducir su TCO en aproximadamente {gap:,.2f} para igualar a {best['alternative']}.",
        ],
        "most_sensitive_variable": "Costo recurrente y costos logísticos cuando existen en los datos.",
    }
