import type { DashboardResult } from '../dashboardCreatorApi';

export const defaultVisualConfig = {
  background: 'white',
  primary: '#0E109E',
  secondary: '#5A31D5',
  danger: '#F3313F',
  success: '#B2EB4A',
};

export function getVisualConfig(result?: Pick<DashboardResult, 'visualConfig'>) {
  return { ...defaultVisualConfig, ...(result?.visualConfig ?? {}) };
}

export function formatValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toLocaleString('es-PE');
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

export function compactDate(value?: string | null) {
  if (!value) return 'No especificado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

const technicalPatterns = [
  /python/i,
  /\bllm\b/i,
  /dataprofile/i,
  /dashboardplan/i,
  /candidatefields/i,
  /anti[-\s]?invenci/i,
  /backend/i,
  /validaci[oó]n interna/i,
  /indicador sugerido/i,
  /source_component/i,
  /calculated/i,
];

export function businessText(value: unknown, fallback = '') {
  const text = formatValue(value).trim();
  if (!text) return fallback;
  if (technicalPatterns.some((pattern) => pattern.test(text))) return fallback;
  return text;
}

export function businessList(values: unknown[] | undefined | null) {
  return asArray(values)
    .map((item) => businessText(item))
    .filter(Boolean);
}

export function sourceLabel(source?: string | null) {
  if (!source) return 'calculado automaticamente';
  return 'calculado automaticamente';
}

const executiveTableBlocklist = [
  /documentos procesados/i,
  /archivos procesados/i,
  /calidad/i,
  /data\s*profile/i,
  /analisis no calculables/i,
  /datos faltantes/i,
];

export function sanitizeDashboardForPublicView(result: DashboardResult): DashboardResult {
  return {
    ...result,
    observations: [],
    missingData: [],
    qualityWarnings: [],
    missing_information: [],
    source_files: [],
    document_summaries: [],
    suggested_filters: [],
    layout_suggestion: [],
    data_understanding: {},
    data_profile: {
      ...result.data_profile,
      data_quality_warnings: [],
      detected_columns: [],
      date_columns: [],
      numeric_columns: [],
      category_columns: [],
      columns: [],
      candidateFields: {},
      rowSamples: [],
      basicStats: {},
      possibleAnalyses: [],
      notPossibleAnalyses: [],
    },
    dataProfile: undefined,
    dashboardPlan: undefined,
    tables: result.tables.filter((table) => {
      const title = businessText(table.title);
      return title && !executiveTableBlocklist.some((pattern) => pattern.test(title));
    }).slice(0, 4),
    findings: (result.findings ?? []).filter((item) => businessText(item.title) && businessText(item.description)).slice(0, 8),
    recommendations: result.recommendations.filter((item) => businessText(item)).slice(0, 8),
    insights: result.insights.filter((item) => businessText(item.title) || businessText(item.description)).slice(0, 8),
    charts: result.charts.filter((chart) => chart.data?.length && businessText(chart.title)).slice(0, 8),
    disclaimer: '',
  };
}

export function uniqueId(prefix: string, index: number) {
  return `${prefix}-${index}`;
}
