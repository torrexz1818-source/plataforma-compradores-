from __future__ import annotations

import json
from typing import Any


SYSTEM_PROMPT = """
Eres un analista senior de compras corporativas especializado en TCO (Total Cost of Ownership),
costos ocultos, evaluacion economica, riesgos de abastecimiento e importacion vs compra local.

Reglas obligatorias:
- El analisis principal lo realizas tu como LLM con la informacion disponible.
- Analiza documentos, imagenes, cotizaciones, propuestas, Excel, CSV, fichas tecnicas, contratos y datos escritos por el usuario.
- Siempre entrega un analisis preliminar util aunque falten datos.
- Si falta informacion, incluye exactamente esta idea: "Con la informacion disponible se puede realizar este analisis preliminar. Para mejorar la precision del TCO, seria recomendable contar con los siguientes datos..."
- No elijas solo por precio inicial.
- No inventes impuestos, aranceles, tipo de cambio, fletes, seguros, costos legales ni regulaciones.
- Si un dato no aparece, usa "No especificado".
- Separa datos encontrados, SUPUESTOS, datos faltantes y limitaciones.
- Todo supuesto debe empezar con la palabra "SUPUESTO".
- No presentes supuestos como datos reales.
- Si puedes estimar cualitativamente, explica que es preliminar y no numerico.
- Sugiere preguntas concretas para proveedores.
- Devuelve exclusivamente JSON valido. No devuelvas markdown fuera del JSON.
- Usa lenguaje ejecutivo, claro y profesional.
- Manten el disclaimer indicado.
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
    "detected_alternatives": [
        {
            "supplier_name": "string",
            "source_file": "string",
            "detected_price": "string",
            "warranty": "string",
            "lead_time": "string",
            "detected_costs": ["string"],
            "data_detected": ["string"],
            "data_missing": ["string"],
            "confidence_level": "low|medium|high",
        }
    ],
    "extracted_data_quality": {
        "detected_alternatives_count": 0,
        "documents_processed": 0,
        "confidence_level": "low|medium|high",
        "warnings": ["string"],
    },
    "data_used": [
        {
            "alternative": "string",
            "base_price": "string",
            "quantity": "string",
            "currency": "string",
            "horizon": "string",
            "origin": "string",
            "destination": "string",
            "incoterm": "string",
            "lead_time": "string",
            "key_assumptions": ["SUPUESTO string"],
        }
    ],
    "tco_matrix": [
        {
            "cost_component": "Precio base | Instalacion | Transporte | Flete | Seguro | Aduanas/impuestos | Mantenimiento | Operacion | Energia | Repuestos | Soporte | Capacitacion | Riesgos | Costos administrativos | Valor residual | TCO total estimado",
            "values": {"Alternativa": "numero o texto"},
            "notes": "string",
        }
    ],
    "tco_totals": [
        {
            "alternative": "string",
            "initial_price": 0,
            "total_tco": 0,
            "tco_per_unit": 0,
            "tco_monthly": 0,
            "tco_annual": 0,
            "risk_level": "low|medium|high",
            "main_hidden_costs": ["string"],
        }
    ],
    "ranking": [
        {
            "position": 1,
            "alternative": "string",
            "ranking_type": "Menor TCO | Menor riesgo | Mejor balance costo-beneficio | Mejor alternativa estrategica",
            "total_tco": 0,
            "reason": "string",
        }
    ],
    "interpretation": {
        "why_winner_wins": "string",
        "hidden_costs": ["string"],
        "cheap_but_risky_options": ["string"],
        "expensive_but_convenient_options": ["string"],
        "conditions_that_change_decision": ["string"],
    },
    "hidden_costs_detected": ["string"],
    "risk_analysis": [
        {
            "risk": "string",
            "alternative": "string",
            "probability": "string",
            "economic_impact": "string",
            "expected_risk_cost": "string",
            "level": "low|medium|high",
            "mitigation": "string",
        }
    ],
    "sensitivity_analysis": {
        "base": ["string"],
        "optimistic": ["string"],
        "pessimistic": ["string"],
        "break_even": ["string"],
        "most_sensitive_variable": "string",
    },
    "strategic_recommendation": {
        "recommended_action": "Comprar local | Importar | Negociar | Pedir mas informacion | Hacer piloto | Dividir compra | Usar como BATNA",
        "negotiation_points": ["string"],
        "next_steps": ["string"],
    },
    "missing_information": ["string"],
    "questions_for_user_or_suppliers": ["string"],
    "assumptions_and_limits": ["string"],
    "supporting_documents_summary": [],
    "disclaimer": "Este analisis TCO es una recomendacion asistida por IA y debe ser validado por el comprador antes de tomar una decision final.",
}


def build_user_prompt(
    *,
    title: str,
    item_name: str,
    analysis_type: str,
    evaluation_horizon: str,
    comparison_unit: str,
    currency: str,
    objective: str | None,
    general_context: str | None,
    additional_instructions: str | None,
    documents: list[dict[str, Any]],
) -> str:
    payload = {
        "analysis_context": {
            "title": title,
            "item_name": item_name,
            "analysis_type": analysis_type,
            "evaluation_horizon": evaluation_horizon,
            "comparison_unit": comparison_unit,
            "currency": currency,
            "objective": objective or "No especificado",
            "general_context": general_context or "No especificado",
            "additional_instructions": additional_instructions or "No especificado",
        },
        "document_context_available_to_model": documents,
        "methodology": [
            "Identifica alternativas/proveedores desde documentos e instrucciones.",
            "Extrae proveedor, marca/modelo, precio, moneda, cantidad, origen/destino, incoterm, flete, seguro, aduanas si aparece, instalacion, mantenimiento, operacion, energia, repuestos, soporte, capacitacion, garantia, vida util, lead time, forma de pago, exclusiones, riesgos y costos no incluidos.",
            "Construye matriz TCO con datos reales cuando existan y usa 'No especificado' cuando no existan.",
            "Genera ranking por menor TCO si hay numeros suficientes; si no, genera ranking preliminar por menor riesgo, mejor balance o mejor alternativa estrategica y explica la limitacion.",
            "Incluye costos ocultos, riesgos bajo/medio/alto, sensibilidad o explica que falta para hacerla.",
            "Incluye informacion faltante con la frase requerida y preguntas sugeridas para proveedores.",
            "No inventes costos ni variables reguladas. Cualquier hipotesis debe empezar con SUPUESTO.",
        ],
        "expected_json_shape": EXPECTED_JSON_SHAPE,
    }

    return (
        "Analiza este caso TCO con enfoque LLM-first. Usa todos los textos, metadatos y, cuando esten adjuntas, "
        "las imagenes enviadas al modelo. Debes entregar un resultado preliminar aunque la informacion sea incompleta. "
        "Devuelve solo JSON valido con la estructura solicitada.\n\n"
        f"{json.dumps(payload, ensure_ascii=False, default=str)}"
    )
