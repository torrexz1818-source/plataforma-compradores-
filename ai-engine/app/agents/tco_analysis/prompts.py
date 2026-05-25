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
- No inventes marcas, modelos, proveedores, red de soporte, disponibilidad de repuestos, garantia, lead time, descuentos, mantenimiento incluido, condiciones tecnicas ni reputacion. Solo mencionalos si aparecen en los documentos o en el contexto escrito por el usuario.
- No infieras "amplia red de soporte", "repuestos disponibles", "garantia integral", "descuento comercial", "stock inmediato" ni beneficios similares por conocimiento general de mercado. Si el documento no lo dice, usa "No especificado".
- Si un dato no aparece, usa "No especificado".
- Separa datos encontrados, SUPUESTOS, datos faltantes y limitaciones.
- Todo supuesto debe empezar con la palabra "SUPUESTO".
- No presentes supuestos como datos reales.
- Cada dato clave debe indicar fuente en el texto cuando sea posible: archivo fuente, texto/contexto del usuario o SUPUESTO. Si no puedes ubicar la fuente, tratalo como "No especificado" o SUPUESTO.
- Nunca coloques TCO, precio, ahorro, sobrecosto o costo esperado como 0 cuando el dato falta. Usa null o "No especificado". Solo usa 0 si el documento dice explicitamente que el costo es cero, gratis, incluido sin costo o equivalente.
- Si puedes estimar cualitativamente, explica que es preliminar y no numerico.
- Siempre califica cada alternativa comparada con un puntaje de 0 a 100, aun si el analisis es preliminar.
- La calificacion debe ponderar TCO/costo total 35%, riesgo 25%, garantia/soporte 20%, disponibilidad/lead time 10% y calidad/confianza de informacion 10%.
- Si faltan datos numericos, no pongas score 0 por defecto: asigna un puntaje preliminar razonado segun la evidencia disponible y reduce la calificacion por baja confianza.
- Incluye score_label con una escala ejecutiva: Excelente (90-100), Muy buena (80-89), Buena (70-79), Regular (60-69), Debil (<60).
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
        "best_alternative_score": 0,
        "best_alternative_score_label": "Excelente|Muy buena|Buena|Regular|Debil",
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
            "source_evidence": ["archivo y breve evidencia textual usada; no inventar"],
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
            "total_tco": "numero o null si no hay datos suficientes",
            "tco_per_unit": "numero o null si no hay datos suficientes",
            "tco_monthly": "numero o null si no hay datos suficientes",
            "tco_annual": "numero o null si no hay datos suficientes",
            "risk_level": "low|medium|high",
            "main_hidden_costs": ["string"],
        }
    ],
    "ranking": [
        {
            "position": 1,
            "alternative": "string",
            "ranking_type": "Menor TCO | Menor riesgo | Mejor balance costo-beneficio | Mejor alternativa estrategica",
            "total_tco": "numero o null si no hay monto real calculable",
            "score": 0,
            "score_label": "Excelente|Muy buena|Buena|Regular|Debil",
            "score_breakdown": {
                "tco_cost_score": 0,
                "risk_score": 0,
                "warranty_support_score": 0,
                "availability_lead_time_score": 0,
                "data_confidence_score": 0,
                "weighted_formula": "35% TCO/costo, 25% riesgo, 20% garantia/soporte, 10% disponibilidad/lead time, 10% confianza de informacion"
            },
            "source_basis": ["datos documentales usados para justificar la posicion; no inventar"],
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
            "Extrae proveedor, marca/modelo, precio, moneda, cantidad, origen/destino, incoterm, flete, seguro, aduanas si aparece, instalacion, mantenimiento, operacion, energia, repuestos, soporte, capacitacion, garantia, vida util, lead time, forma de pago, exclusiones, riesgos y costos no incluidos. Si no aparece, escribe No especificado.",
            "Construye matriz TCO con datos reales cuando existan y usa 'No especificado' cuando no existan.",
            "No uses conocimiento general externo para completar datos del proveedor. El analisis debe estar anclado en documentos/contexto del usuario.",
            "No pongas total_tco, tco_per_unit, tco_monthly, tco_annual o ahorro en 0 cuando falten montos. Usa null o No especificado y explica que no hay base cuantitativa.",
            "Genera ranking por menor TCO si hay numeros suficientes; si no, genera ranking preliminar por menor riesgo, mejor balance o mejor alternativa estrategica y explica la limitacion.",
            "Califica cada alternativa de 0 a 100 usando la formula ponderada solicitada. Nunca devuelvas score 0 solo porque falten montos: si falta informacion, calcula una calificacion preliminar con penalizacion por confianza baja.",
            "El primer lugar debe ser la alternativa con mayor score general, salvo que haya TCO numerico claramente menor y riesgo aceptable. Explica cualquier excepcion.",
            "Incluye costos ocultos, riesgos bajo/medio/alto, sensibilidad o explica que falta para hacerla.",
            "Incluye informacion faltante con la frase requerida y preguntas sugeridas para proveedores.",
            "No inventes costos ni variables reguladas. Cualquier hipotesis debe empezar con SUPUESTO y no debe mezclarse con datos encontrados.",
        ],
        "expected_json_shape": EXPECTED_JSON_SHAPE,
    }

    return (
        "Analiza este caso TCO con enfoque LLM-first y estricto anclaje documental. Usa solo textos, metadatos, contexto del usuario "
        "y, cuando esten adjuntas, las imagenes enviadas al modelo. Debes entregar un resultado preliminar aunque la informacion sea incompleta, "
        "pero no debes completar huecos con informacion externa o inventada. "
        "Devuelve solo JSON valido con la estructura solicitada.\n\n"
        f"{json.dumps(payload, ensure_ascii=False, default=str)}"
    )
