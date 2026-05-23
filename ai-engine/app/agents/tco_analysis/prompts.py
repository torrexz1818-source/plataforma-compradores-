from __future__ import annotations

import json
from typing import Any


SYSTEM_PROMPT = """
Eres un Agente Especialista en Análisis TCO — Total Cost of Ownership — para compras estratégicas,
proveedores, importaciones, servicios, maquinaria, software, vehículos, repuestos, insumos y productos
o servicios empresariales.

Reglas obligatorias:
- No elijas por precio inicial. Justifica con números, riesgos y lógica de negocio.
- No inventes impuestos, aranceles, tipo de cambio, regulaciones, fletes, seguros ni cargos aduaneros.
- Separa datos entregados, datos extraídos de documentos, SUPUESTOS e información faltante.
- Todo supuesto debe empezar con la palabra "SUPUESTO".
- Si falta información, lista preguntas concretas para usuario o proveedor.
- Si puedes avanzar con advertencias, hazlo sin inventar montos.
- Devuelve exclusivamente JSON válido. No devuelvas markdown fuera del JSON.
- Usa lenguaje ejecutivo, claro y profesional.
- Mantén el disclaimer indicado.
"""


EXPECTED_JSON_SHAPE = {
    "analysis_title": "string",
    "item_name": "string",
    "analysis_type": "string",
    "evaluation_horizon": "string",
    "comparison_unit": "string",
    "currency": "string",
    "executive_summary": {
        "best_alternative": "string",
        "why_it_wins": "string",
        "estimated_saving_or_overcost": "string",
        "main_risk": "string",
        "final_recommendation": "string",
    },
    "data_used": [],
    "tco_matrix": [],
    "tco_totals": [],
    "ranking": [],
    "interpretation": {
        "why_winner_wins": "string",
        "hidden_costs": [],
        "cheap_but_risky_options": [],
        "expensive_but_convenient_options": [],
        "conditions_that_change_decision": [],
    },
    "risk_analysis": [],
    "sensitivity_analysis": {
        "base": [],
        "optimistic": [],
        "pessimistic": [],
        "break_even": [],
        "most_sensitive_variable": "string",
    },
    "strategic_recommendation": {
        "recommended_action": "Comprar local / Importar / Negociar / Pedir más información / Hacer piloto / Dividir compra / Usar como BATNA",
        "negotiation_points": [],
        "next_steps": [],
    },
    "missing_information": [],
    "questions_for_user_or_suppliers": [],
    "assumptions_and_limits": [],
    "supporting_documents_summary": [],
    "disclaimer": "Este análisis TCO es una recomendación asistida por IA y debe ser validado por el comprador antes de tomar una decisión final.",
}


def build_user_prompt(
    *,
    title: str,
    item_name: str,
    analysis_type: str,
    evaluation_horizon: str,
    comparison_unit: str,
    currency: str,
    purchase_volume: str | None,
    objective: str | None,
    alternatives: list[dict[str, Any]],
    additional_instructions: str | None,
    documents: list[dict[str, Any]],
    python_calculations: dict[str, Any],
) -> str:
    payload = {
        "analysis_context": {
            "title": title,
            "item_name": item_name,
            "analysis_type": analysis_type,
            "evaluation_horizon": evaluation_horizon,
            "comparison_unit": comparison_unit,
            "currency": currency,
            "purchase_volume": purchase_volume or "No especificado",
            "objective": objective or "No especificado",
            "additional_instructions": additional_instructions or "No especificado",
        },
        "alternatives_from_user": alternatives,
        "document_context_compact": documents,
        "python_calculations": python_calculations,
        "methodology": [
            "Define alcance, alternativas, origen/destino, horizonte, unidad, moneda, volumen y condiciones.",
            "Clasifica costos por adquisición, logística, implementación, operación, mantenimiento, financieros, riesgo, administración, salida y valor residual.",
            "Calcula y explica TCO total, por unidad, mensual o anual cuando haya datos suficientes.",
            "Para importación vs local, compara costo puesto almacén con costo local real y advierte ilusión de precio bajo si aplica.",
            "Convierte riesgos a costo esperado solo si hay probabilidad e impacto económico entregados.",
            "Incluye escenarios base, optimista, pesimista y punto de equilibrio.",
        ],
        "expected_json_shape": EXPECTED_JSON_SHAPE,
    }

    return (
        "Analiza el siguiente caso TCO. Usa los cálculos Python como fuente de validación numérica "
        "cuando estén disponibles y completa la interpretación ejecutiva sin inventar datos.\n\n"
        f"{json.dumps(payload, ensure_ascii=False, default=str)}"
    )
