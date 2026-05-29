import type { ExportBlockType } from './types';

export const buyerNodusExportTheme = {
  colors: {
    navy: '#09008B',
    navySoft: '#EEF2FF',
    text: '#1F2937',
    muted: '#64748B',
    border: '#CBD5E1',
    accent: '#F97316',
    success: '#65A30D',
    warning: '#F59E0B',
    danger: '#DC2626',
    white: '#FFFFFF',
  },
  fonts: {
    heading: 'helvetica',
    body: 'helvetica',
  },
};

export function blockTone(type: ExportBlockType) {
  if (type === 'alert' || type === 'risk') return buyerNodusExportTheme.colors.warning;
  if (type === 'recommendation' || type === 'decision') return buyerNodusExportTheme.colors.success;
  if (type === 'kpi' || type === 'ranking') return buyerNodusExportTheme.colors.accent;
  return buyerNodusExportTheme.colors.navy;
}

export function blockLabel(type: ExportBlockType) {
  const labels: Record<ExportBlockType, string> = {
    summary: 'Resumen ejecutivo',
    kpi: 'KPIs',
    chart: 'Visualizaciones',
    table: 'Tablas',
    insight: 'Hallazgos',
    risk: 'Riesgos',
    recommendation: 'Recomendaciones',
    decision: 'Decision',
    matrix: 'Matriz',
    timeline: 'Cronograma',
    dashboard_filter: 'Filtros sugeridos',
    alert: 'Alertas',
    ranking: 'Ranking',
  };
  return labels[type];
}
