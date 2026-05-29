import type { ExportPayload } from '../types';
import { isRenderable } from '../isRenderable';
import { asArray, asRecord, block, firstRenderable, keyValueTable, tableFromRows, text } from './utils';

function cleanValue(value: unknown): unknown {
  if (typeof value === 'string') {
    const cleaned = text(value).trim();
    return isRenderable(cleaned) ? cleaned : undefined;
  }
  if (Array.isArray(value)) {
    const cleaned = value.map(cleanValue).filter(isRenderable);
    return cleaned.length ? cleaned : undefined;
  }
  if (value && typeof value === 'object') {
    const cleaned = Object.entries(asRecord(value)).reduce<Record<string, unknown>>((acc, [key, item]) => {
      const nextValue = cleanValue(item);
      if (isRenderable(nextValue)) acc[key] = nextValue;
      return acc;
    }, {});
    return isRenderable(cleaned) ? cleaned : undefined;
  }
  return isRenderable(value) ? value : undefined;
}

function cleanText(value: unknown) {
  const cleaned = cleanValue(value);
  return typeof cleaned === 'string' ? cleaned : text(cleaned);
}

function compactRows<T extends Record<string, unknown>>(rows: T[]) {
  return rows
    .map((row) => Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
      const nextValue = cleanValue(value);
      if (isRenderable(nextValue)) acc[key] = nextValue;
      return acc;
    }, {}))
    .filter(isRenderable);
}

function directCostRows(data: Record<string, unknown>) {
  return compactRows(asArray(data.financial_model).map(asRecord).map((item) => ({
    Alternativa: item.alternative ?? item.Alternativa,
    'Costo inicial': item.acquisition_costs ?? item.initial_cost ?? item.initial_price ?? item['Costo inicial'],
    Logistica: item.logistics_costs ?? item.transport_costs ?? item['Transporte/logistica'],
    Implementacion: item.implementation_costs ?? item['Implementacion'],
    Operacion: item.operating_costs ?? item['Costos operativos'],
    Mantenimiento: item.maintenance_costs ?? item['Mantenimiento'],
    Soporte: item.support_costs ?? item['Soporte'],
    Seguros: item.insurance_costs ?? item['Seguros'],
    Riesgo: item.risk_costs ?? item['Riesgos'],
    Residual: item.residual_value ?? item['Valor residual'],
    'TCO neto': item.net_tco ?? item.total_tco ?? item.TCO,
    'TCO anual': item.annualized_tco ?? item.tco_annual,
    'TCO unitario': item.unit_tco ?? item.tco_per_unit,
    Confianza: item.confidence_level,
  })));
}

function matrixRows(data: Record<string, unknown>) {
  const financialRows = directCostRows(data);
  if (financialRows.length) return tableFromRows(financialRows, 'Matriz TCO editable');
  const tcoRows = compactRows(asArray(data.tco_matrix).map(asRecord));
  return tableFromRows(tcoRows, 'Matriz TCO editable');
}

function rankingRows(data: Record<string, unknown>) {
  const scoreRows = asArray(asRecord(data.scorecard).totals).map(asRecord);
  const ranking = scoreRows.length ? scoreRows : asArray(data.ranking).map(asRecord);
  return compactRows(ranking.map((item, index) => ({
    Posicion: item.rank ?? item.position ?? index + 1,
    Alternativa: item.alternative,
    Score: item.total_score ?? item.score,
    Nivel: item.level ?? item.score_label,
    'TCO total': item.total_tco,
    Motivo: item.reason ?? item.main_strength,
    Riesgo: item.main_weakness,
  })));
}

function scenarioRows(data: Record<string, unknown>) {
  return compactRows([
    ...asArray(data.scenarios).map(asRecord),
    ...asArray(data.sensitivity_analysis).map(asRecord),
    ...asArray(data.scenario_analysis).map(asRecord),
  ]);
}

function hiddenCostRows(data: Record<string, unknown>) {
  return compactRows([
    ...asArray(data.hidden_costs_detected).map((item) => ({ Costo: item })),
    ...asArray(data.tco_totals).map(asRecord).flatMap((item) => asArray(item.main_hidden_costs).map((cost) => ({
      Alternativa: item.alternative,
      Costo: cost,
    }))),
  ]);
}

function riskRows(data: Record<string, unknown>) {
  return compactRows(asArray(data.risk_analysis).map(asRecord).map((item) => ({
    Riesgo: item.risk,
    Alternativa: item.alternative,
    Probabilidad: item.probability,
    Impacto: item.economic_impact ?? item.impact,
    'Costo esperado': item.expected_risk_cost,
    Nivel: item.level,
    Mitigacion: item.mitigation,
  })));
}

function decisionData(data: Record<string, unknown>) {
  const summary = asRecord(data.executive_summary);
  const recommendation = asRecord(data.strategic_recommendation);
  const rankings = rankingRows(data);
  const alternatives = new Set([
    ...rankings.map((row) => cleanText(row.Alternativa)),
    ...directCostRows(data).map((row) => cleanText(row.Alternativa)),
  ].filter(Boolean));
  const recommended = cleanText(recommendation.final_recommended_option ?? summary.best_alternative ?? rankings[0]?.Alternativa);
  if (alternatives.size >= 2 && recommended) {
    return {
      Decision: `Opcion recomendada: ${recommended}`,
      Sustento: firstRenderable(recommendation.recommendation_rationale, summary.why_it_wins, summary.final_recommendation),
      Estado: 'Con recomendacion financiera',
    };
  }
  return {
    Decision: 'Decision no concluyente',
    Sustento: 'No hay al menos dos alternativas comparables con costos suficientes para recomendar una opcion financiera.',
    Estado: 'Requiere validacion',
  };
}

function kpiRows(data: Record<string, unknown>) {
  const summary = asRecord(data.executive_summary);
  const recommendation = asRecord(data.strategic_recommendation);
  const matrix = directCostRows(data);
  const rankings = rankingRows(data);
  const hiddenCosts = hiddenCostRows(data);
  const risks = riskRows(data);
  return compactRows([
    { title: 'Opcion recomendada', value: recommendation.final_recommended_option ?? summary.best_alternative ?? rankings[0]?.Alternativa, description: summary.why_it_wins ?? recommendation.recommendation_rationale },
    { title: 'Alternativas comparadas', value: new Set(matrix.map((row) => cleanText(row.Alternativa)).filter(Boolean)).size || rankings.length, description: 'Opciones con informacion financiera disponible' },
    { title: 'Horizonte', value: data.evaluation_horizon, description: 'Periodo usado para comparar costo total' },
    { title: 'Ahorro / sobrecosto', value: summary.estimated_saving_or_overcost, description: 'Diferencia economica relevante si fue calculada' },
    { title: 'Costos ocultos', value: hiddenCosts.length, description: 'Costos indirectos o no evidentes detectados' },
    { title: 'Riesgos financieros', value: risks.length, description: 'Riesgos con impacto economico identificado' },
  ]);
}

export function tcoResultToExportPayload(result: unknown): ExportPayload {
  const data = asRecord(result);
  const summary = asRecord(data.executive_summary);
  const strategicRecommendation = asRecord(data.strategic_recommendation);
  const scenarios = scenarioRows(data);
  const hiddenCosts = hiddenCostRows(data);

  return {
    agentId: 'tco_analysis',
    title: text(data.analysis_title, 'Analisis de Costo Total / TCO'),
    subtitle: [
      text(data.item_name),
      text(data.evaluation_horizon),
      text(data.currency),
    ].filter(Boolean).join(' | '),
    blocks: [
      block('tco-summary', 'summary', 'Resumen ejecutivo financiero', cleanValue(summary), 10, undefined, 'executive-summary'),
      block('tco-decision', 'decision', 'Decision financiera', decisionData(data), 15, cleanText(strategicRecommendation.recommendation_rationale), 'decision-card'),
      block('tco-kpis', 'kpi', 'Indicadores TCO', kpiRows(data), 20, undefined, 'kpi-cards'),
      block('tco-matrix', 'matrix', 'Matriz TCO editable', matrixRows(data), 30),
      block('tco-scorecard', 'ranking', 'Ranking financiero', rankingRows(data), 40),
      block('tco-financial-model', 'table', 'Modelo financiero', tableFromRows(directCostRows(data)), 50),
      block('tco-scenarios', 'table', 'Escenarios y sensibilidad', tableFromRows(scenarios), 55),
      block('tco-hidden-costs', 'alert', 'Costos ocultos', tableFromRows(hiddenCosts), 58),
      block('tco-risks', 'risk', 'Riesgos financieros', tableFromRows(riskRows(data)), 60),
      block('tco-recommendations', 'recommendation', 'Recomendaciones financieras', cleanValue(firstRenderable(strategicRecommendation.next_steps, strategicRecommendation.negotiation_points, strategicRecommendation.recommendation_rationale)), 80),
      block('tco-missing-information', 'alert', 'Informacion requerida para cerrar TCO', cleanValue(firstRenderable(data.missing_information, data.questions_for_user_or_suppliers, data.assumptions_and_limits)), 90),
      block('tco-data-used', 'table', 'Datos base del analisis', keyValueTable({ item_name: data.item_name, analysis_type: data.analysis_type, comparison_unit: data.comparison_unit, evaluation_horizon: data.evaluation_horizon, currency: data.currency }), 100),
    ],
  };
}
