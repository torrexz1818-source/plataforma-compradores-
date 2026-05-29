import type { ExportPayload } from '../types';
import { asArray, asRecord, block, firstRenderable, keyValueTable, tableFromRows, text } from './utils';

export function tcoResultToExportPayload(result: unknown): ExportPayload {
  const data = asRecord(result);
  const summary = asRecord(data.executive_summary);
  const strategicRecommendation = asRecord(data.strategic_recommendation);

  return {
    agentId: 'tco_analysis',
    title: text(data.analysis_title, 'Analisis de Costo Total / TCO'),
    subtitle: [
      text(data.item_name),
      text(data.evaluation_horizon),
      text(data.currency),
    ].filter(Boolean).join(' | '),
    blocks: [
      block('tco-summary', 'summary', 'Resumen ejecutivo', summary, 10, undefined, 'executive-summary'),
      block(
        'tco-kpis',
        'kpi',
        'Indicadores clave',
        [
          { title: 'Mejor alternativa', value: summary.best_alternative, description: summary.why_it_wins },
          { title: 'Puntaje', value: summary.best_alternative_score, description: summary.best_alternative_score_label },
          { title: 'Ahorro / sobrecosto', value: summary.estimated_saving_or_overcost },
          { title: 'Riesgo principal', value: summary.main_risk },
        ],
        20,
        undefined,
        'kpi-cards',
      ),
      block('tco-matrix', 'matrix', 'Matriz TCO comparativa', firstRenderable(data.tco_dashboard_matrix, tableFromRows(asArray(data.tco_matrix))), 30),
      block('tco-scorecard', 'ranking', 'Scorecard y ranking', firstRenderable(asRecord(data.scorecard).totals, data.ranking), 40),
      block('tco-financial-model', 'table', 'Modelo financiero', tableFromRows(asArray(data.financial_model)), 50),
      block('tco-risks', 'risk', 'Analisis de riesgos', data.risk_analysis, 60),
      block('tco-decision', 'decision', 'Decision recomendada', strategicRecommendation, 70),
      block(
        'tco-recommendations',
        'recommendation',
        'Siguientes pasos',
        firstRenderable(strategicRecommendation.next_steps, strategicRecommendation.negotiation_points, strategicRecommendation.recommendation_rationale),
        80,
      ),
      block('tco-missing-information', 'alert', 'Informacion por validar', firstRenderable(data.missing_information, data.questions_for_user_or_suppliers, data.assumptions_and_limits), 90),
      block('tco-data-used', 'table', 'Datos usados', keyValueTable({ item_name: data.item_name, analysis_type: data.analysis_type, comparison_unit: data.comparison_unit }), 100),
    ],
  };
}
