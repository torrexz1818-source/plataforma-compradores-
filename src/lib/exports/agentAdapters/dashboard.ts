import type { ExportPayload } from '../types';
import { asArray, asRecord, block, firstRenderable, tableFromRows, text } from './utils';

function dashboardFilterRows(data: Record<string, unknown>) {
  return [
    { Filtro: 'Audiencia', Valor: text(data.audience) },
    { Filtro: 'Periodo', Valor: text(data.period) },
    { Filtro: 'Tipo de datos', Valor: text(data.data_type) },
    ...asArray(data.suggested_filters).map((item, index) => ({ Filtro: `Filtro sugerido ${index + 1}`, Valor: text(item) })),
  ].filter((row) => row.Valor);
}

function dashboardRankingRows(data: Record<string, unknown>) {
  return asArray(data.charts)
    .map(asRecord)
    .filter((chart) => asArray(chart.data).length)
    .flatMap((chart) => asArray(chart.data).map(asRecord).slice(0, 6).map((point, index) => ({
      Ranking: index + 1,
      Vista: text(chart.title, 'Visualizacion'),
      Concepto: text(point.label),
      Valor: point.value,
    })))
    .filter((row) => row.Concepto && row.Valor !== undefined)
    .slice(0, 18);
}

export function dashboardResultToExportPayload(result: unknown): ExportPayload {
  const data = asRecord(result);
  const title = text(data.dashboard_title || asRecord(data.metadata).report_name, 'Dashboard ejecutivo de compras');
  const executiveSummary = asRecord(data.executiveSummary);
  const filters = dashboardFilterRows(data);
  const rankings = dashboardRankingRows(data);

  return {
    agentId: 'dashboard_creator',
    title,
    subtitle: [
      text(data.audience),
      text(data.period),
      text(data.data_type),
    ].filter(Boolean).join(' | '),
    blocks: [
      block(
        'dashboard-summary',
        'summary',
        'Resumen ejecutivo',
        firstRenderable(executiveSummary.information_found, data.executive_summary),
        10,
        text(executiveSummary.analysis_built),
        'executive-cover',
      ),
      block('dashboard-kpis', 'kpi', 'KPIs principales', asArray(data.kpis), 20, undefined, 'kpi-cards'),
      block('dashboard-charts', 'chart', 'Visualizaciones ejecutivas', asArray(data.charts), 30, undefined, 'power-bi-panels'),
      block('dashboard-rankings', 'ranking', 'Rankings ejecutivos', rankings, 35, undefined, 'ranking-cards'),
      block(
        'dashboard-tables',
        'table',
        'Tablas filtrables',
        asArray(data.tables).map((table) => {
          const tableRecord = asRecord(table);
          return {
            title: tableRecord.title,
            description: tableRecord.description,
            columns: asArray(tableRecord.columns),
            rows: asArray(tableRecord.rows).map(asRecord),
          };
        }),
        40,
        undefined,
        'analytic-tables',
      ),
      block('dashboard-insights', 'insight', 'Hallazgos', firstRenderable(data.insights, data.findings), 50),
      block('dashboard-recommendations', 'recommendation', 'Recomendaciones', data.recommendations, 60),
      block('dashboard-filters', 'dashboard_filter', 'Filtros del dashboard', filters, 70),
      block(
        'dashboard-alerts',
        'alert',
        'Informacion por completar',
        firstRenderable(data.missing_information, data.missingData, asArray(asRecord(data.data_profile).data_quality_warnings)),
        80,
      ),
    ],
  };
}
