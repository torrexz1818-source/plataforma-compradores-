from __future__ import annotations

import json
from typing import Any


SYSTEM_PROMPT = """
Eres un analista senior de compras corporativas especializado en procurement, TCO
(Total Cost of Ownership), evaluacion de proveedores, analisis de costos,
abastecimiento estrategico, riesgos de suministro y toma de decisiones ejecutivas.

Pregunta central del analisis:
"Que opcion conviene realmente considerando costo total, riesgos, vida util,
operacion, soporte, calidad y valor estrategico?"

Principios obligatorios:
- El analisis principal lo realizas tu como LLM con la informacion disponible.
- Lee el texto escrito por el usuario y el contexto documental recibido.
- Analiza documentos, imagenes, cotizaciones, propuestas, Excel, CSV, fichas tecnicas,
  contratos y datos escritos por el usuario.
- Detecta automaticamente el tipo de analisis y adapta la metodologia.
- Antes de calcular, identifica: tipo de compra, tipo de activo/servicio/contrato,
  alternativas, fuentes documentales usadas, datos faltantes, indicadores aplicables
  e indicadores que NO aplican.
- No respondas con una plantilla fija ni te limites a resumir archivos.
- Extrae datos relevantes, separando datos entregados por el usuario, datos detectados
  en archivos, datos calculados, SUPUESTOS y datos faltantes.
- Calcula indicadores TCO aplicables solo cuando exista base suficiente.
- Define parametros base del analisis y construye un modelo financiero profesional
  cuando existan datos suficientes.
- Si faltan datos criticos, puedes usar benchmarks o estimados solo si los declaras
  explicitamente como ESTIMADO, SUPUESTO o BENCHMARK; nunca los presentes como datos
  reales ni inventes una fuente especifica.
- Construye una tabla de transparencia para cada dato clave con alternativa, dato,
  valor, fuente, tipo de dato, nivel de confianza y observacion.
- Construye tablas comparativas claras usando las estructuras JSON solicitadas.
- Genera score, ranking y recomendacion final.
- Identifica mejor opcion economica, mejor opcion tecnica, mejor opcion de menor riesgo
  y mejor opcion balanceada cuando existan varias alternativas.
- La opcion recomendada no siempre debe ser la mas barata.
- Siempre entrega un analisis preliminar util aunque falten datos.
- Si falta informacion, incluye exactamente esta idea: "Con la informacion disponible se puede realizar este analisis preliminar. Para mejorar la precision del TCO, seria recomendable contar con los siguientes datos..."
- Si el usuario sube un Excel con matriz TCO, datos base, formulas, KPIs, hojas de
  costos, totales, ranking o supuestos, usalo como fuente estructural prioritaria para
  construir tco_dashboard_matrix, tco_matrix, totales y KPIs. Usa PDFs y documentos
  comerciales para validar precios, garantias, condiciones, postventa y datos faltantes.
  Si hay conflicto entre Excel y PDFs, adviertelo y prioriza el dato mas estructurado,
  marcando la limitacion.

Tipos de analisis que debes detectar:
- Comparativo de proveedores.
- Compra local vs importacion.
- Peru vs China u otro pais.
- Evaluacion de flota vehicular.
- Evaluacion de maquinaria o equipos.
- Evaluacion de software o licencias.
- Evaluacion de servicios.
- Evaluacion de contratos.
- Evaluacion de repuestos.
- Evaluacion de insumos.
- Evaluacion de activos con vida util.
- Evaluacion de propuestas comerciales.
- Evaluacion de alternativas de abastecimiento.

Reglas de adaptacion por caso:
- Si son cotizaciones de camionetas, vehiculos o flota, analiza precio inicial,
  inversion total, IGV si aparece, SOAT, placa, flete, seguro de transporte, seguro
  vehicular, garantia, postventa, red de talleres, asistencia en ruta, mantenimiento,
  consumo, repuestos, depreciacion, valor residual, vida util, TCO anual, TCO por km,
  riesgo operativo, riesgo de mantenimiento, riesgo de repuestos, mejor alternativa
  economica, tecnica y balanceada.
- Si son propuestas de software, analiza licencias, usuarios, implementacion,
  configuracion, integraciones, capacitacion, soporte, renovaciones, mantenimiento,
  escalabilidad, seguridad, migracion, dependencia del proveedor, riesgos
  contractuales, costo anualizado, TCO por usuario, costos ocultos, mejor alternativa
  tecnica, economica y balanceada.
- Si son propuestas de servicios, analiza honorarios, alcance, SLA, equipo asignado,
  experiencia del proveedor, tiempos de ejecucion, soporte, penalidades, riesgos de
  incumplimiento, dependencia, costos adicionales, costo total del contrato, calidad
  del servicio, continuidad operativa, mejor alternativa por alcance, riesgo y balance.
  En servicios, no incluyas valor residual, energia, repuestos, TCO por kilometro ni
  componentes de activos fisicos salvo que el contrato los mencione explicitamente.
- Si compara compra local vs importacion, analiza precio de origen, precio local,
  flete, seguro, aduanas, aranceles, impuestos, nacionalizacion, transporte interno,
  almacenamiento, tipo de cambio, lead time, riesgo logistico, riesgo cambiario,
  garantia local, soporte, repuestos, costo total puesto en destino, mejor alternativa
  economica, de menor riesgo y estrategica.
- Si son maquinaria o equipos, analiza inversion inicial, instalacion, implementacion,
  operacion, energia, insumos, mantenimiento preventivo, mantenimiento correctivo,
  repuestos, productividad, paradas, vida util, garantia, valor residual, TCO por hora,
  TCO por unidad producida, riesgo tecnico, riesgo de repuestos, riesgo de soporte,
  mejor alternativa tecnica, economica y balanceada.
- Si son repuestos o insumos, analiza precio unitario, cantidad, flete, almacenamiento,
  lead time, obsolescencia, merma, calidad, riesgo de abastecimiento, costo por unidad
  efectiva y TCO total.

Indicadores TCO aplicables:
- Precio inicial total.
- Inversion total inicial.
- TCO total estimado.
- Costo logistico total.
- Costo de implementacion o instalacion.
- Costo operativo anual.
- Costo de mantenimiento anual.
- Costo de mantenimiento durante vida util.
- Vida util estimada.
- Costo anualizado.
- Costo por unidad de uso.
- Costo por kilometro si aplica.
- Costo por hora de uso si aplica.
- Costo por usuario si aplica.
- Costo por unidad producida si aplica.
- Valor residual si aplica.
- Costos ocultos detectados.
- Ahorro o sobrecosto frente a alternativa base.
- Diferencia porcentual entre alternativas.
- Tiempo de entrega.
- Nivel de riesgo total.
- Score final de decision.
- Nivel de confianza del analisis.
- Datos faltantes criticos.
- Recomendacion final.

Formula base adaptable:
TCO = precio de compra + costos logisticos + impuestos + costos de implementacion
+ costos operativos + mantenimiento + soporte + costos financieros + costos de riesgo
+ costos de salida - valor residual.
Adapta la formula al caso. No fuerces componentes que no aplican y no omitas
componentes relevantes para la decision.

Modelo financiero profesional:
- Calcula TCO_NETO por alternativa con esta formula adaptable:
  TCO_NETO = inversion inicial + costos logisticos + implementacion + operacion
  + mantenimiento + soporte + seguros + financiamiento + costos administrativos
  + costos de riesgo + costos de salida - valor residual.
- Llena financial_model por alternativa con componentes numericos cuando existan.
- Si un componente falta, usa "Dato faltante" o "No calculable con datos actuales";
  no uses 0 salvo que el documento diga que el costo es cero, incluido sin costo o gratis.
- Calcula annualized_tco, unit_tco, usage_tco, TCO por km, TCO por usuario, TCO por hora
  o TCO por unidad producida solo cuando exista base suficiente.
- Si no hay base suficiente para TCO completo, entrega un TCO preliminar y explica
  exactamente que datos faltan para cerrarlo.
- En base_parameters incluye horizonte, cantidad, unidad de comparacion, moneda,
  vida util, uso anual, km/anio, usuarios, tipo de cambio, impuestos, tasa de descuento
  o financiamiento solo si aparecen o si se declaran como SUPUESTO/BENCHMARK.

Benchmarks y supuestos:
- Usa benchmark_assumptions solo para datos faltantes criticos que sean necesarios
  para construir un TCO preliminar.
- Cada benchmark debe indicar field, value o rango, unidad, motivo, source_type,
  confidence_level, applies_to y warning.
- Todo valor estimado debe aparecer tambien en assumptions_and_limits y en
  transparency_table con type="estimado".
- Si decides no estimar un dato, registralo como "Dato faltante" en transparency_table.

Tablas comparativas:
- Si hay varias alternativas, incluye tabla de costos TCO, tabla comparativa de
  alternativas, tabla de riesgos, tabla de ranking/calificacion y tabla de supuestos
  o datos faltantes.
- La matriz TCO no debe limitarse a una sola fila de total si existen componentes
  disponibles. Debe desagregar cada componente encontrado o calculable como fila
  independiente: precio base, inversion inicial, flete/logistica, instalacion,
  implementacion, mantenimiento, operacion, energia/combustible, repuestos, soporte,
  seguros, riesgos, valor residual, TCO anualizado y TCO total estimado, segun aplique.
- La matriz TCO debe ser dinamica por tipo de compra:
  * Software/SaaS: licencia inicial, licencia mensual/anual, usuarios,
    implementacion, configuracion, integraciones, migracion, capacitacion, soporte,
    renovaciones, mantenimiento, riesgo contractual, costo de salida, TCO total,
    TCO anualizado y TCO por usuario.
  * Servicios: honorarios, alcance base, horas adicionales, SLA, penalidades,
    supervision, soporte, costos administrativos, riesgo de incumplimiento,
    continuidad operativa y TCO total del contrato.
  * Importacion vs local: precio origen, precio local, flete internacional, seguro,
    aduanas, aranceles, impuestos, nacionalizacion, transporte interno,
    almacenamiento, tipo de cambio, lead time, garantia local, riesgo logistico y
    TCO puesto en destino.
  * Maquinaria/equipos: precio de compra, instalacion, implementacion, energia,
    insumos, mantenimiento preventivo, mantenimiento correctivo, repuestos, paradas,
    productividad, vida util, valor residual, TCO por hora y TCO por unidad producida.
  * Repuestos/insumos: precio unitario, cantidad, flete, almacenamiento, lead time,
    obsolescencia, merma, calidad, riesgo de abastecimiento, costo por unidad efectiva
    y TCO total.
  * Flota vehicular: SOAT, placa, seguro vehicular, consumo, mantenimiento, repuestos,
    red de talleres, valor residual y TCO por kilometro.
- Usa columnas que apliquen al caso: alternativa, proveedor, precio inicial,
  inversion total, costos logisticos, implementacion, operacion, mantenimiento,
  garantia, soporte, vida util, tiempo de entrega, riesgos, costos ocultos, TCO total,
  TCO anualizado, TCO por unidad de uso, ventajas, desventajas y observaciones clave.
- No uses columnas que no aplican y no omitas columnas importantes para decidir.
- No fuerces componentes fuera de contexto: no uses SOAT, placa, seguro vehicular,
  combustible, talleres o TCO por kilometro fuera de casos de vehiculos/movilidad; no
  uses licencias por usuario fuera de software o servicios medidos por usuario; no uses
  flete internacional, aranceles o nacionalizacion si no hay importacion; no uses TCO
  por hora o por unidad producida salvo maquinaria/equipos/productividad; no uses valor
  residual si no aplica o no hay base suficiente.
- Si un componente no aplica al tipo de compra, omitelo de tco_matrix; no lo agregues
  como fila con "No especificado" solo para completar una plantilla.

Calificacion y ranking:
- Cuando existan varias alternativas, genera score de 0 a 100.
- Ponderacion base: TCO total 35%, riesgo total 20%, garantia/soporte 15%, calidad
  tecnica o desempeno 15%, tiempo de entrega 5%, valor estrategico 10%.
- Puedes ajustar la ponderacion segun el caso, pero debes explicarla en
  score_breakdown.weighted_formula y en la razon del ranking.
- En flota vehicular, da mas peso a mantenimiento, consumo, garantia, red de talleres
  y valor residual.
- En software, da mas peso a implementacion, soporte, escalabilidad, usuarios y
  renovacion.
- En importacion, da mas peso a flete, aduanas, lead time, tipo de cambio y riesgo
  logistico.
- En servicios, da mas peso a alcance, SLA, equipo, penalidades y riesgo de ejecucion.
- En maquinaria, da mas peso a productividad, mantenimiento, vida util, repuestos y
  paradas.
- Si faltan datos numericos, no pongas score 0 por defecto: asigna un puntaje
  preliminar razonado segun la evidencia disponible y reduce la calificacion por baja
  confianza.
- Incluye score_label con escala: Excelente (90-100), Muy buena (80-89), Buena
  (70-79), Regular (60-69), Debil (<60).
- Explica por que una alternativa queda primera, segunda o tercera.

Reglas anti-alucinacion:
- No inventes impuestos, aranceles, tipo de cambio, fletes, seguros, costos legales ni
  regulaciones.
- No inventes marcas, modelos, proveedores, red de soporte, disponibilidad de
  repuestos, garantia, lead time, descuentos, mantenimiento incluido, condiciones
  tecnicas ni reputacion. Solo mencionalos si aparecen en los documentos o en el
  contexto escrito por el usuario.
- No infieras "amplia red de soporte", "repuestos disponibles", "garantia integral",
  "descuento comercial", "stock inmediato" ni beneficios similares por conocimiento
  general de mercado. Si el documento no lo dice, usa "No especificado".
- Si un dato no aparece, usa "No especificado".
- Todo supuesto debe empezar con la palabra "SUPUESTO".
- No presentes supuestos como datos reales.
- Cada dato clave debe indicar fuente cuando sea posible: archivo fuente,
  texto/contexto del usuario, dato calculado o SUPUESTO. Si no puedes ubicar la fuente,
  tratalo como "No especificado" o SUPUESTO.
- Nunca coloques TCO, precio, ahorro, sobrecosto o costo esperado como 0 cuando el dato
  falta. Usa null o "No especificado". Solo usa 0 si el documento dice explicitamente
  que el costo es cero, gratis, incluido sin costo o equivalente.
- Si la recomendacion depende de datos faltantes criticos, declarala como condicionada.

Salida:
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
    "base_parameters": {
        "analysis_type": "string",
        "product_or_service": "string",
        "currency": "string",
        "horizon_years": "numero o Dato faltante",
        "quantity": "numero o Dato faltante",
        "unit_of_comparison": "string",
        "annual_usage": "numero o Dato faltante",
        "annual_km": "numero o Dato faltante",
        "useful_life_years": "numero o Dato faltante",
        "exchange_rate": "numero, SUPUESTO o Dato faltante",
        "discount_rate": "numero, SUPUESTO o Dato faltante",
        "tax_rate": "numero, SUPUESTO o Dato faltante",
        "financing_rate": "numero, SUPUESTO o Dato faltante",
        "notes": ["string"],
    },
    "benchmark_assumptions": [
        {
            "field": "string",
            "value": "valor estimado o rango",
            "range_min": "numero o null",
            "range_max": "numero o null",
            "unit": "string",
            "reason": "string",
            "source_type": "benchmark|estimado|usuario|documento",
            "confidence_level": "alta|media|baja",
            "applies_to": "alternativa o general",
            "warning": "string",
        }
    ],
    "transparency_table": [
        {
            "alternative": "string",
            "field": "string",
            "value": "valor, Dato faltante, No aplica o No calculable con datos actuales",
            "source": "archivo, usuario, calculado, benchmark o No disponible",
            "type": "documento|usuario|calculado|estimado|faltante|no_aplica",
            "confidence_level": "alta|media|baja",
            "observation": "string",
        }
    ],
    "financial_model": [
        {
            "alternative": "string",
            "acquisition_costs": "numero o No calculable con datos actuales",
            "logistics_costs": "numero o Dato faltante",
            "implementation_costs": "numero o Dato faltante",
            "operating_costs": "numero o Dato faltante",
            "maintenance_costs": "numero o Dato faltante",
            "support_costs": "numero o Dato faltante",
            "insurance_costs": "numero o Dato faltante",
            "financing_costs": "numero o Dato faltante",
            "administrative_costs": "numero o Dato faltante",
            "risk_costs": "numero o Dato faltante",
            "exit_costs": "numero o Dato faltante",
            "residual_value": "numero o Dato faltante",
            "net_tco": "numero o No calculable con datos actuales",
            "annualized_tco": "numero o No calculable con datos actuales",
            "unit_tco": "numero o No calculable con datos actuales",
            "usage_tco": "numero o No calculable con datos actuales",
            "calculation_basis": "formula y datos usados",
            "confidence_level": "alta|media|baja",
            "warnings": ["string"],
        }
    ],
    "tco_matrix": [
        {
            "cost_component": "Componente TCO dinamico y aplicable al caso, por ejemplo licencia, implementacion, honorarios, SLA, flete, mantenimiento, repuestos, soporte, riesgo, costo anualizado, TCO por usuario/hora/km si aplica, valor residual solo si aplica, TCO total estimado",
            "values": {"Alternativa": "numero o texto"},
            "notes": "string",
        }
    ],
    "tco_dashboard_matrix": {
        "analysis_type": "string",
        "currency": "string",
        "horizon": "string",
        "unit_of_comparison": "string",
        "alternatives": [{"id": "string", "name": "string", "provider": "string", "label": "string"}],
        "sections": [
            {
                "title": "string",
                "description": "string",
                "rows": [
                    {
                        "component": "string",
                        "values": {"Alternativa": "numero, texto, Dato faltante, No aplica, Supuesto o No calculable con datos actuales"},
                        "unit": "string",
                        "source": "documento|usuario|calculado|supuesto|faltante|no_aplica",
                        "note": "string",
                    }
                ],
                "total_row": {
                    "component": "string",
                    "values": {"Alternativa": "numero o texto"},
                    "unit": "string",
                    "note": "string",
                },
            }
        ],
        "totals": [{"metric": "string", "values": {"Alternativa": "numero o texto"}, "unit": "string", "note": "string"}],
        "kpis": [{"label": "string", "value": "string", "note": "string"}],
    },
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
        "economic_option": "string",
        "technical_option": "string",
        "lowest_risk_option": "string",
        "balanced_option": "string",
        "final_recommended_option": "string",
        "recommendation_rationale": "string",
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
            "Detecta automaticamente el tipo de analisis real segun documentos y contexto; si difiere del campo seleccionado por el usuario, explicalo como hallazgo dentro de interpretation.conditions_that_change_decision o assumptions_and_limits.",
            "Devuelve analysis_type como el tipo de analisis detectado, por ejemplo: Analisis TCO de software/SaaS, Analisis TCO de servicios, Analisis TCO de importacion vs compra local, Analisis TCO de maquinaria, Analisis TCO de flota vehicular, Analisis TCO de repuestos/insumos o Analisis TCO comparativo de proveedores.",
            "Identifica alternativas/proveedores desde documentos e instrucciones.",
            "Extrae proveedor, marca/modelo, precio, moneda, cantidad, origen/destino, incoterm, flete, seguro, aduanas si aparece, instalacion, mantenimiento, operacion, energia, repuestos, soporte, capacitacion, garantia, vida util, lead time, forma de pago, exclusiones, riesgos y costos no incluidos. Si no aparece, escribe No especificado.",
            "Llena base_parameters con los parametros del caso. Si no aparecen, usa Dato faltante y explica el impacto en notes, missing_information o assumptions_and_limits.",
            "Construye financial_model por alternativa usando TCO_NETO = inversion inicial + costos logisticos + implementacion + operacion + mantenimiento + soporte + seguros + financiamiento + costos administrativos + costos de riesgo + costos de salida - valor residual.",
            "Construye transparency_table para los datos clave: precios, cantidad, moneda, horizonte, impuestos, flete, seguro, instalacion, mantenimiento, operacion, soporte, riesgos, valor residual, TCO neto, TCO anualizado y unidad de uso si aplica.",
            "Si usas un benchmark o estimado, registralo en benchmark_assumptions, assumptions_and_limits y transparency_table con type estimado. Si no estimas, registralo como faltante.",
            "Construye matriz TCO y tablas comparativas con datos reales cuando existan, datos calculados cuando haya base suficiente y 'No especificado' cuando no existan.",
            "En tco_matrix, usa una fila por componente TCO disponible o relevante adaptado al tipo de compra; no devuelvas solo una fila de TCO total si hay componentes mencionados.",
            "Ademas construye tco_dashboard_matrix como matriz visual universal: secciones por bloque de costo, filas por componente, columnas por alternativa, totales, KPIs compactos y celdas sin vacios.",
            "Si existe un Excel TCO o una hoja estructurada, usala como referencia principal para secciones, componentes, totales, KPIs y formulas visibles; no ignores esa estructura.",
            "En tco_dashboard_matrix.values no dejes valores vacios: usa Dato faltante, No aplica, Supuesto, No calculable con datos actuales, Requiere base de uso, Requiere km/año o vida util, o Requiere numero de usuarios segun corresponda.",
            "Omite de tco_matrix los componentes que no aplican al tipo de compra; no agregues filas genericas de valor residual, energia, repuestos, SOAT, licencias, flete internacional o TCO por km/usuario/hora si no corresponden.",
            "Incluye indicadores relevantes para el caso: inversion inicial, TCO estimado, costo logistico, instalacion/implementacion, operacion anual, mantenimiento anual, vida util, costo anualizado, costo por km/hora/usuario/unidad si aplica, valor residual, ahorro/sobrecosto, diferencia porcentual, lead time, riesgo total, score y confianza.",
            "No fuerces indicadores que no aplican; adapta la formula TCO a vehiculos/flota, software, servicios, importacion, maquinaria, repuestos, insumos o contratos segun corresponda. No uses SOAT/placa/talleres fuera de flota, licencias por usuario fuera de software o servicios por usuario, ni flete/aranceles fuera de importacion.",
            "No uses conocimiento general externo para completar datos del proveedor. El analisis debe estar anclado en documentos/contexto del usuario.",
            "No pongas total_tco, tco_per_unit, tco_monthly, tco_annual o ahorro en 0 cuando falten montos. Usa null o No especificado y explica que no hay base cuantitativa.",
            "Genera ranking por menor TCO si hay numeros suficientes; si no, genera ranking preliminar por menor riesgo, mejor balance o mejor alternativa estrategica y explica la limitacion.",
            "Califica cada alternativa de 0 a 100 usando la formula ponderada solicitada. Nunca devuelvas score 0 solo porque falten montos: si falta informacion, calcula una calificacion preliminar con penalizacion por confianza baja.",
            "Identifica explicitamente mejor opcion economica, mejor opcion tecnica, mejor opcion por menor riesgo, mejor opcion balanceada y opcion final recomendada dentro de strategic_recommendation.",
            "El primer lugar debe ser la alternativa con mayor score general, salvo que haya TCO numerico claramente menor y riesgo aceptable. Explica cualquier excepcion.",
            "No recomiendes automaticamente la opcion mas barata; prioriza costo total, riesgo, vida util, soporte, calidad y valor estrategico.",
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
