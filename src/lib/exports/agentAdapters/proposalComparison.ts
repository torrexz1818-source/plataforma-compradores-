import type { ExportPayload } from '../types';
import { isRenderable } from '../isRenderable';
import { asArray, asRecord, block, firstRenderable, tableFromRows, text } from './utils';

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

function supplierRecords(result: Record<string, unknown>) {
  return asArray(result.suppliers).map(asRecord).filter((supplier) => cleanText(supplier.supplier_name));
}

function supplierNames(result: Record<string, unknown>) {
  return supplierRecords(result).map((supplier) => cleanText(supplier.supplier_name)).filter(Boolean);
}

function scoreValue(row: Record<string, unknown>) {
  const raw = row.weighted_score ?? row.score ?? row.total_score ?? row.final_score;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function scoreLabel(row: Record<string, unknown>) {
  const score = scoreValue(row);
  if (score === undefined) return cleanText(row.weighted_score ?? row.score);
  return score <= 5 ? `${score.toFixed(2)} / 5` : `${Math.round(score)} / 100`;
}

function signalFor(row: Record<string, unknown>, index: number, recommendedName: string) {
  const provider = cleanText(row.supplier_name ?? row.Proveedor);
  const score = scoreValue(row);
  if (provider && recommendedName && provider.toLowerCase() === recommendedName.toLowerCase()) return 'Recomendado';
  if (score !== undefined) {
    const normalized = score <= 5 ? score * 20 : score;
    if (normalized >= 85) return 'Recomendado';
    if (normalized >= 70) return 'Competitivo';
    if (normalized >= 55) return 'Revisar';
    return 'Riesgoso';
  }
  return index === 0 && recommendedName ? 'Recomendado' : 'Revisar';
}

function executiveComparisonTable(result: Record<string, unknown>) {
  const suppliers = supplierNames(result);
  const rows = compactRows(asArray(result.executive_comparison_table).map(asRecord).map((row) => {
    const values = asRecord(row.values);
    return {
      'Dato clave': row.row_label,
      ...suppliers.reduce<Record<string, unknown>>((acc, supplier) => {
        acc[supplier] = values[supplier];
        return acc;
      }, {}),
    };
  }));
  return tableFromRows(rows, 'Resumen ejecutivo comparativo');
}

function comparisonTable(result: Record<string, unknown>) {
  const suppliers = supplierNames(result);
  const rows = compactRows(asArray(result.comparison_table).map(asRecord).map((row) => {
    const values = asRecord(row.values);
    return {
      Criterio: row.criterion,
      ...suppliers.reduce<Record<string, unknown>>((acc, supplier) => {
        acc[supplier] = values[supplier];
        return acc;
      }, {}),
      'Observacion para negociacion': row.comment,
    };
  }));
  return tableFromRows(rows, 'Matriz comparativa editable');
}

function rankingRows(result: Record<string, unknown>, recommendedName: string) {
  const rows = asArray(result.ranking).map(asRecord);
  return compactRows(rows.map((row, index) => ({
    Posicion: row.position ?? index + 1,
    Proveedor: row.supplier_name,
    Puntaje: scoreLabel(row),
    Semaforo: signalFor(row, index, recommendedName),
    Motivo: row.reason,
    'Fortalezas principales': asArray(row.main_strengths).map(cleanText).filter(Boolean).join(' | '),
    'Riesgos principales': asArray(row.main_risks).map(cleanText).filter(Boolean).join(' | '),
  })));
}

function weightedRows(result: Record<string, unknown>, recommendedName: string) {
  return compactRows(asArray(asRecord(result.evaluation_matrix).weighted_totals).map(asRecord).map((row, index) => ({
    Posicion: row.ranking_position ?? index + 1,
    Proveedor: row.supplier_name,
    Puntaje: scoreLabel(row),
    Semaforo: signalFor(row, index, recommendedName),
  })));
}

function evaluationRows(result: Record<string, unknown>) {
  const suppliers = supplierNames(result);
  return compactRows(asArray(asRecord(result.evaluation_matrix).criteria).map(asRecord).map((criterion) => {
    const ratings = asRecord(criterion.ratings);
    return {
      Criterio: criterion.criterion,
      'Peso %': criterion.weight_percent,
      ...suppliers.reduce<Record<string, unknown>>((acc, supplier) => {
        acc[supplier] = ratings[supplier];
        return acc;
      }, {}),
      Observaciones: criterion.observations,
    };
  }));
}

function decisionData(result: Record<string, unknown>, recommendedName: string) {
  const suppliers = supplierRecords(result);
  const ranking = asArray(result.ranking).map(asRecord);
  const hasEnoughProviders = suppliers.length >= 2;
  const hasRanking = ranking.length >= 2 || Boolean(recommendedName);
  if (hasEnoughProviders && hasRanking && recommendedName) {
    return {
      Decision: `Proveedor recomendado: ${recommendedName}`,
      Sustento: firstRenderable(result.final_recommendation, result.executive_summary),
      Estado: 'Con recomendacion',
    };
  }
  return {
    Decision: 'Decision no concluyente',
    Sustento: 'No hay informacion suficiente para recomendar un proveedor ganador sin riesgo de sesgo.',
    Estado: 'Requiere validacion',
  };
}

function kpiRows(result: Record<string, unknown>, recommendedName: string) {
  const suppliers = supplierRecords(result);
  const ranking = rankingRows(result, recommendedName);
  const comparisonRows = asArray(result.comparison_table).filter(isRenderable);
  const risks = [
    ...asArray(result.global_risks),
    ...supplierRecords(result).flatMap((supplier) => asArray(supplier.risks)),
  ].filter(isRenderable);
  return compactRows([
    { title: 'Proveedores comparados', value: suppliers.length, description: 'Cantidad de propuestas consideradas' },
    { title: 'Proveedor recomendado', value: recommendedName || 'No concluyente', description: recommendedName ? 'Mejor alternativa segun la evaluacion disponible' : 'Falta informacion para definir ganador' },
    { title: 'Criterios evaluados', value: comparisonRows.length, description: 'Variables usadas para comparar propuestas' },
    { title: 'Riesgos identificados', value: risks.length, description: 'Puntos a revisar antes de adjudicar' },
    { title: 'Estado de decision', value: recommendedName && suppliers.length >= 2 ? 'Lista para validar' : 'Requiere validacion', description: 'Nivel de suficiencia para decision ejecutiva' },
  ]);
}

function missingAlerts(result: Record<string, unknown>) {
  return cleanValue(firstRenderable(result.missing_information, result.questions_for_suppliers));
}

export function proposalComparisonToExportPayload(result: unknown): ExportPayload {
  const data = asRecord(result);
  const ranking = asArray(data.ranking).map(asRecord);
  const recommendedName = cleanText(data.recommended_supplier || ranking[0]?.supplier_name);
  const suppliers = supplierRecords(data);
  const canCompareProviders = suppliers.length >= 2;
  const rankingData = rankingRows(data, recommendedName);
  const weightedData = weightedRows(data, recommendedName);
  const decision = decisionData(data, recommendedName);
  return {
    agentId: 'proposal_comparison',
    title: text(data.analysis_title, 'Comparativo de propuestas de proveedores'),
    subtitle: [text(data.service), text(data.objective)].filter(Boolean).join(' | '),
    blocks: [
      block('proposal-summary', 'summary', 'Resumen ejecutivo', cleanValue(data.executive_summary), 10),
      block('proposal-decision', 'decision', 'Decision ejecutiva', decision, 20, cleanText(data.final_recommendation), 'decision-card'),
      block('proposal-kpis', 'kpi', 'Indicadores del comparativo', kpiRows(data, recommendedName), 25, undefined, 'kpi-cards'),
      block('proposal-ranking', 'ranking', 'Ranking de proveedores', canCompareProviders ? firstRenderable(rankingData, weightedData) : undefined, 30),
      block('proposal-evaluation-matrix', 'matrix', 'Matriz de evaluacion', evaluationRows(data), 40, cleanText(data.auto_generated_criteria_note)),
      block('proposal-weighted-totals', 'ranking', 'Puntaje ponderado total', canCompareProviders ? weightedData : undefined, 45),
      block('proposal-executive-table', 'table', 'Resumen comparativo', executiveComparisonTable(data), 50),
      block('proposal-comparison-table', 'table', 'Matriz comparativa editable', comparisonTable(data), 60),
      block('proposal-risks', 'risk', 'Riesgos principales', cleanValue(firstRenderable(data.global_risks, supplierRecords(data).flatMap((supplier) => asArray(supplier.risks)))), 70),
      block('proposal-final-recommendation', 'recommendation', 'Recomendaciones de negociacion', cleanValue(data.final_recommendation), 80),
      block('proposal-missing-information', 'alert', 'Informacion requerida para cerrar decision', missingAlerts(data), 90),
    ],
  };
}
