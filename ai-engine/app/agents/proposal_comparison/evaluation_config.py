from __future__ import annotations

from typing import Any


DEFAULT_EVALUATION_CRITERIA: list[dict[str, Any]] = [
    {
        "number": 1,
        "criterion": "Cumplimiento tecnico y alcance",
        "weight_percent": 25,
        "verification_source": "Propuesta tecnica, alcance, especificaciones y entregables declarados.",
    },
    {
        "number": 2,
        "criterion": "Precio y costo total evaluable",
        "weight_percent": 20,
        "verification_source": "Precio total, moneda, impuestos, costos adicionales, descuentos y condiciones economicas.",
    },
    {
        "number": 3,
        "criterion": "Condiciones comerciales y forma de pago",
        "weight_percent": 15,
        "verification_source": "Forma de pago, vigencia de oferta, reajustes, contrato minimo, penalidades y condiciones contractuales.",
    },
    {
        "number": 4,
        "criterion": "Plazo de entrega o implementacion",
        "weight_percent": 10,
        "verification_source": "Cronograma, lead time, disponibilidad, capacidad de cumplimiento y dependencias declaradas.",
    },
    {
        "number": 5,
        "criterion": "Garantia, soporte y servicio postventa",
        "weight_percent": 10,
        "verification_source": "Garantia, SLA, soporte, mantenimiento, atencion postventa y canales de escalamiento.",
    },
    {
        "number": 6,
        "criterion": "Certificaciones, experiencia y referencias",
        "weight_percent": 10,
        "verification_source": "Certificaciones, homologaciones, experiencia, referencias, casos previos y capacidades del proveedor.",
    },
    {
        "number": 7,
        "criterion": "Riesgos, exclusiones e informacion faltante",
        "weight_percent": 10,
        "verification_source": "Exclusiones, supuestos, vacios documentales, riesgos operativos, legales, comerciales y tecnicos.",
    },
]


def default_criteria_prompt_block() -> str:
    rows = [
        (
            f"{item['number']}. {item['criterion']} - "
            f"{item['weight_percent']}% - Fuente: {item['verification_source']}"
        )
        for item in DEFAULT_EVALUATION_CRITERIA
    ]
    return "\n".join(rows)
