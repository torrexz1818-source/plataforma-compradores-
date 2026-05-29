import type { ExportPayload } from '../types';
import { asArray, asRecord, block, firstRenderable, tableFromRows, text } from './utils';

function executiveComparisonTable(result: Record<string, unknown>) {
  const suppliers = asArray(result.suppliers).map(asRecord).map((supplier) => text(supplier.supplier_name)).filter(Boolean);
  const rows = asArray(result.executive_comparison_table).map(asRecord).map((row) => {
    const values = asRecord(row.values);
    return {
      'Dato clave': row.row_label,
      ...suppliers.reduce<Record<string, unknown>>((acc, supplier) => {
        acc[supplier] = values[supplier];
        return acc;
      }, {}),
    };
  });
  return tableFromRows(rows, 'Resumen ejecutivo comparativo');
}

function comparisonTable(result: Record<string, unknown>) {
  const suppliers = asArray(result.suppliers).map(asRecord).map((supplier) => text(supplier.supplier_name)).filter(Boolean);
  const rows = asArray(result.comparison_table).map(asRecord).map((row) => {
    const values = asRecord(row.values);
    return {
      Criterio: row.criterion,
      ...suppliers.reduce<Record<string, unknown>>((acc, supplier) => {
        acc[supplier] = values[supplier];
        return acc;
      }, {}),
      Comentario: row.comment,
    };
  });
  return tableFromRows(rows, 'Tabla comparativa');
}

export function proposalComparisonToExportPayload(result: unknown): ExportPayload {
  const data = asRecord(result);
  return {
    agentId: 'proposal_comparison',
    title: text(data.analysis_title, 'Comparativo de propuestas de proveedores'),
    subtitle: text(data.service),
    blocks: [
      block('proposal-summary', 'summary', 'Resumen ejecutivo', data.executive_summary, 10),
      block('proposal-decision', 'decision', 'Proveedor recomendado', data.recommended_supplier, 20, text(data.final_recommendation), 'decision-card'),
      block('proposal-ranking', 'ranking', 'Ranking', data.ranking, 30),
      block('proposal-evaluation-matrix', 'matrix', 'Matriz de evaluacion', asRecord(data.evaluation_matrix).criteria, 40, text(data.auto_generated_criteria_note)),
      block('proposal-weighted-totals', 'ranking', 'Puntaje ponderado total', asRecord(data.evaluation_matrix).weighted_totals, 45),
      block('proposal-executive-table', 'table', 'Resumen comparativo', executiveComparisonTable(data), 50),
      block('proposal-comparison-table', 'table', 'Tabla comparativa', comparisonTable(data), 60),
      block('proposal-risks', 'risk', 'Riesgos globales', firstRenderable(data.global_risks, asArray(data.suppliers).flatMap((supplier) => asArray(asRecord(supplier).risks))), 70),
      block('proposal-final-recommendation', 'recommendation', 'Recomendacion final', data.final_recommendation, 80),
      block('proposal-missing-information', 'alert', 'Informacion por completar', firstRenderable(data.missing_information, data.questions_for_suppliers), 90),
    ],
  };
}
