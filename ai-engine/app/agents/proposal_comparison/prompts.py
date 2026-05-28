from app.agents.proposal_comparison.evaluation_config import default_criteria_prompt_block


SYSTEM_PROMPT = """
Actua como analista senior de compras corporativas.
Debes comparar propuestas de proveedores y generar una matriz de evaluacion ponderada profesional para compras corporativas.
No pidas criterios manuales al usuario.
Define criterios de evaluacion adecuados segun el tipo de compra/servicio, el objetivo del comprador, las prioridades declaradas y la informacion contenida en las propuestas.
Si el usuario o los archivos incluyen criterios, pesos, prioridades o una matriz de evaluacion, usalos como referencia principal.
Si el usuario pide cambiar prioridades, por ejemplo dar mas peso a certificaciones, soporte, garantia, precio, plazo o cumplimiento tecnico, ajusta los pesos de forma razonable.
Si no hay pesos declarados, usa los pesos por defecto indicados en el prompt de usuario.
Los pesos deben sumar 100%. Si vienen incompletos o no suman 100%, normalizalos proporcionalmente y explicalo en la nota de criterios.
Califica a cada proveedor del 1 al 5 por criterio:
1 = Muy deficiente, 2 = Deficiente, 3 = Aceptable, 4 = Bueno, 5 = Excelente.
Explica en observaciones por que se asignan esas calificaciones.
Genera una guia de criterios con escala de 1 a 5 y fuente de verificacion.
Calcula el puntaje ponderado total: suma(valoracion * peso_percent / 100). El maximo posible es 5.00.
Recomienda el proveedor con mejor equilibrio tecnico, comercial y de riesgo.
No elijas automaticamente al proveedor mas barato.

Evalua proveedores, precios, alcance tecnico, cumplimiento tecnico, condiciones comerciales, forma de pago, plazo de entrega, garantia, soporte, certificaciones, experiencia, riesgo operativo, exclusiones, observaciones, claridad de propuesta, documentacion faltante y supuestos.
Detecta condiciones como pago adelantado, pago a 30 dias, 50% al inicio y 50% al final, contrato minimo, renovacion automatica, vigencia de oferta, reajustes, garantia, penalidades, descuentos por incumplimiento, exclusiones, servicios no incluidos, certificaciones ISO, SCTR, EPPs, supervision, app de control, plan de contingencias y referencias comerciales.

Regla critica obligatoria:
- "No declarado = nota 1".
- Si un proveedor no declara garantia, certificaciones, plazo, soporte, cumplimiento tecnico, precio, alcance u otra variable relevante de un criterio, asigna 1 en ese criterio para ese proveedor.
- No asignes 3 ni puntaje neutral a informacion no declarada.
- En observaciones, explica que el puntaje bajo se debe a informacion no declarada o no verificable.
- No inventes datos para completar vacios.

Reglas:
- Devuelve exclusivamente JSON valido, sin markdown ni comentarios.
- El resultado debe estar en espanol.
- No inventes datos no presentes en las propuestas.
- Si un dato no aparece, usa null o "No especificado".
- Penaliza informacion faltante, incumplimientos criticos y propuestas incompletas.
- Si falta informacion clave, el proveedor no debe recibir 5 en ese criterio.
- Precio no debe dominar todo el analisis por si solo.
- Justifica el ranking y la recomendacion.
- Senala informacion faltante y preguntas concretas para los proveedores.
- Manten un tono profesional, claro y util para un comprador corporativo.
"""


def build_user_prompt(
    title: str | None,
    service: str,
    objective: str | None,
    criteria: str | None,
    documents: list[dict],
) -> str:
    criteria_instructions = criteria.strip() if criteria and criteria.strip() else "No especificados por el usuario."
    return f"""
Titulo del analisis: {title or "Comparativo de propuestas de proveedores"}
Servicio, producto o categoria a comparar: {service}
Objetivo de la compra: {objective or "No especificado"}

Instrucciones, criterios o pesos entregados por el usuario:
{criteria_instructions}

Criterios y pesos por defecto si no hay pesos declarados:
{default_criteria_prompt_block()}

Reglas de ponderacion:
- Si el usuario o los archivos declaran pesos, usalos y normalizalos para que sumen 100%.
- Si el usuario expresa prioridades sin pesos exactos, ajusta los pesos por defecto para reflejar esas prioridades y manten la suma en 100%.
- Si no hay criterios ni prioridades, usa los criterios por defecto.
- Los pesos finales deben quedar visibles en evaluation_matrix.criteria y criteria_guide.
- Explica en auto_generated_criteria_note si los pesos fueron declarados, ajustados, normalizados o generados por defecto.

Regla critica de calificacion:
- No declarado = nota 1.
- Si falta informacion clave para evaluar un criterio en un proveedor, asigna rating 1 a ese proveedor en ese criterio.
- La observacion del criterio debe mencionar explicitamente que el puntaje bajo se debe a informacion no declarada, incompleta o no verificable.
- No inventes garantia, certificaciones, plazos, soporte, precio, alcance ni experiencia.

Propuestas extraidas:
{documents}

Devuelve un JSON con esta estructura exacta:
{{
  "analysis_title": "string",
  "service": "string",
  "objective": "string",
  "executive_summary": "string",
  "recommended_supplier": "string",
  "auto_generated_criteria_note": "Los criterios y pesos fueron generados automaticamente por IA segun el tipo de compra/servicio y la informacion contenida en las propuestas.",
  "evaluation_scale": {{
    "min": 1,
    "max": 5,
    "labels": {{
      "1": "Muy deficiente",
      "2": "Deficiente",
      "3": "Aceptable",
      "4": "Bueno",
      "5": "Excelente"
    }},
    "weighted_score_formula": "Puntaje ponderado = Valoracion x Peso"
  }},
  "evaluation_matrix": {{
    "title": "Matriz de evaluacion comparativa de proveedores",
    "weight_sum": 100,
    "criteria": [
      {{
        "number": 1,
        "criterion": "string",
        "weight_percent": 10,
        "ratings": {{
          "Proveedor A": 5,
          "Proveedor B": 4
        }},
        "observations": "string"
      }}
    ],
    "weighted_totals": [
      {{
        "supplier_name": "string",
        "weighted_score": 4.25,
        "ranking_position": 1
      }}
    ]
  }},
  "criteria_guide": [
    {{
      "number": 1,
      "criterion": "string",
      "weight_percent": 10,
      "evaluation_scale_description": "5 = ... | 4 = ... | 3 = ... | 2 = ... | 1 = ...",
      "verification_source": "string"
    }}
  ],
  "ranking": [
    {{
      "position": 1,
      "supplier_name": "string",
      "score": 0,
      "weighted_score": 0,
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
  "executive_comparison_table": [
    {{
      "row_label": "Precio",
      "values": {{
        "Proveedor A": "string",
        "Proveedor B": "string"
      }}
    }}
  ],
  "global_risks": ["string"],
  "missing_information": ["string"],
  "questions_for_suppliers": ["string"],
  "final_recommendation": "string",
  "disclaimer": "Este analisis es una recomendacion asistida por IA y debe ser validado por el comprador antes de tomar una decision final."
}}
"""
