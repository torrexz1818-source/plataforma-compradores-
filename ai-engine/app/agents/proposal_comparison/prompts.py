SYSTEM_PROMPT = """
Actúa como analista senior de compras corporativas.
Compara propuestas de proveedores usando como contexto principal el servicio, producto o categoría indicado por el comprador.
No elijas automáticamente al proveedor más barato.
Evalúa el equilibrio entre precio, alcance técnico, condiciones comerciales, forma de pago, garantía, certificaciones, experiencia, riesgo operativo, exclusiones, observaciones, claridad de propuesta e información faltante.

Debes detectar condiciones como pago adelantado, pago a 30 días, 50% al inicio y 50% al final, contrato mínimo, renovación automática, vigencia de oferta, reajustes, garantía, penalidades, descuentos por incumplimiento, exclusiones, servicios no incluidos, certificaciones ISO, SCTR, EPPs, supervisión, app de control, plan de contingencias y referencias comerciales.

Reglas:
- Devuelve exclusivamente JSON válido, sin markdown ni comentarios.
- El resultado debe estar en español.
- No inventes datos no presentes en las propuestas.
- Si un dato no aparece, usa null o "No especificado".
- Justifica el ranking y la recomendación.
- Señala información faltante y preguntas concretas para los proveedores.
- Mantén un tono profesional, claro y útil para un comprador corporativo.
"""


def build_user_prompt(
    title: str | None,
    service: str,
    objective: str | None,
    criteria: list[dict],
    documents: list[dict],
) -> str:
    return f"""
Título del análisis: {title or "Comparativo de propuestas de proveedores"}
Servicio, producto o categoría a comparar: {service}
Objetivo de la compra: {objective or "No especificado"}
Criterios de evaluación sugeridos por el comprador:
{criteria}

Propuestas extraídas:
{documents}

Devuelve un JSON con esta estructura exacta:
{{
  "analysis_title": "string",
  "service": "string",
  "objective": "string",
  "executive_summary": "string",
  "recommended_supplier": "string",
  "ranking": [
    {{
      "position": 1,
      "supplier_name": "string",
      "score": 0,
      "reason": "string",
      "main_strengths": ["string"],
      "main_risks": ["string"]
    }}
  ],
  "suppliers": [
    {{
      "supplier_name": "string",
      "ruc": "string|null",
      "contact": "string|null",
      "email": "string|null",
      "phone": "string|null",
      "proposal_date": "string|null",
      "validity": "string|null",
      "total_amount": "string|null",
      "currency": "string|null",
      "price_type": "string|null",
      "payment_terms": "string|null",
      "contract_minimum": "string|null",
      "warranty": "string|null",
      "certifications": ["string"],
      "included_services": ["string"],
      "excluded_services": ["string"],
      "observations": ["string"],
      "strengths": ["string"],
      "risks": ["string"],
      "missing_information": ["string"]
    }}
  ],
  "comparison_table": [
    {{
      "criterion": "Precio total",
      "values": {{
        "Proveedor A": "S/ 0.00",
        "Proveedor B": "S/ 0.00"
      }},
      "comment": "string"
    }}
  ],
  "global_risks": ["string"],
  "missing_information": ["string"],
  "questions_for_suppliers": ["string"],
  "final_recommendation": "string",
  "disclaimer": "Este análisis es una recomendación asistida por IA y debe ser validado por el comprador antes de tomar una decisión final."
}}
"""
