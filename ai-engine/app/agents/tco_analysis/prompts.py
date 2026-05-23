from __future__ import annotations

import json
from typing import Any


SYSTEM_PROMPT = """
Eres un Agente Especialista en Analisis TCO - Total Cost of Ownership - para compras estrategicas,
proveedores, importaciones, servicios, maquinaria, software, vehiculos, repuestos, insumos y productos
o servicios empresariales.

Reglas obligatorias:
- El usuario ya no llena manualmente todas las alternativas. Debes extraer proveedores y alternativas desde documentos cargados.
- Analiza cotizaciones, propuestas, imagenes, fichas tecnicas, Excel, CSV o PDFs para identificar proveedores, costos, condiciones, plazos, garantias y riesgos.
- No elijas por precio inicial. Justifica con numeros, riesgos y logica de negocio.
- No inventes impuestos, aranceles, tipo de cambio, regulaciones, fletes, seguros ni cargos aduaneros.
- Si un dato no aparece, usa "No especificado".
- Separa datos encontrados en documentos, datos entregados por el comprador, SUPUESTOS e informacion faltante.
- Todo supuesto debe empezar con la palabra "SUPUESTO".
- Si falta informacion, lista preguntas concretas para usuario o proveedor.
- Si puedes avanzar con advertencias, hazlo sin inventar montos.
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
            "data_detected": ["precio", "garantia", "lead time"],
            "data_missing": ["mantenimiento", "repuestos", "vida util"],
            "confidence_level": "low|medium|high",
        }
    ],
    "extracted_data_quality": {
        "detected_alternatives_count": 0,
        "documents_processed": 0,
        "confidence_level": "low|medium|high",
        "warnings": ["string"],
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
        "recommended_action": "Comprar local / Importar / Negociar / Pedir mas informacion / Hacer piloto / Dividir compra / Usar como BATNA",
        "negotiation_points": [],
        "next_steps": [],
    },
    "missing_information": [],
    "questions_for_user_or_suppliers": [],
    "assumptions_and_limits": [],
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
    purchase_volume: str | None,
    objective: str | None,
    alternatives: list[dict[str, Any]],
    general_context: str | None,
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
            "general_context": general_context or "No especificado",
            "additional_instructions": additional_instructions or "No especificado",
        },
        "alternatives_from_user_fallback": alternatives,
        "document_context_compact": documents,
        "python_calculations": python_calculations,
        "methodology": [
            "Extrae alternativas/proveedores desde documentos. Si alternatives_from_user_fallback tiene datos, usalos solo como fallback.",
            "Para cada proveedor detecta: proveedor, marca/modelo, producto/servicio, precio, moneda, cantidad, origen/destino, incoterm, flete, seguro, aduanas, instalacion, mantenimiento, operacion, energia, repuestos, soporte, capacitacion, garantia, vida util, lead time, forma de pago, exclusiones, costos no incluidos, riesgos y observaciones.",
            "Define alcance, alternativas, origen/destino, horizonte, unidad, moneda, volumen y condiciones.",
            "Clasifica costos por adquisicion, logistica, implementacion, operacion, mantenimiento, financieros, riesgo, administracion, salida y valor residual.",
            "Calcula y explica TCO total, por unidad, mensual o anual cuando haya datos suficientes.",
            "Para importacion vs local, compara costo puesto almacen con costo local real y advierte ilusion de precio bajo si aplica.",
            "Convierte riesgos a costo esperado solo si hay probabilidad e impacto economico entregados.",
            "Incluye escenarios base, optimista, pesimista y punto de equilibrio.",
        ],
        "expected_json_shape": EXPECTED_JSON_SHAPE,
    }

    return (
        "Analiza el siguiente caso TCO. Extrae primero las alternativas desde los documentos cargados. "
        "Usa los calculos Python como fuente de validacion numerica cuando esten disponibles y completa "
        "la interpretacion ejecutiva sin inventar datos. Separa datos encontrados en documentos, datos "
        "entregados por el comprador, SUPUESTOS e informacion faltante.\n\n"
        f"{json.dumps(payload, ensure_ascii=False, default=str)}"
    )
