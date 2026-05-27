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
  if (typeof value === 'number' && Number.isNaN(value)) return '';
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

const emptyExecutiveValuePattern = /^(nan|null|undefined|none|n\/a|na)$/i;
const amountColumnPattern = /monto|total|importe|valor|subtotal|saldo|precio|ahorro|gasto|cantidad|%|porcentaje/i;

function isEmptyExecutiveValue(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return Number.isNaN(value);
  const text = formatValue(value).trim();
  return !text || emptyExecutiveValuePattern.test(text);
}

function hasNumericExecutiveValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value);
  const numeric = Number(formatValue(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) && numeric !== 0;
}

function isUsefulExecutiveRow(row: Record<string, unknown>, columns: string[]) {
  const dimensionColumns = columns.filter((column) => !amountColumnPattern.test(column));
  const hasDimension = dimensionColumns.some((column) => !isEmptyExecutiveValue(row[column]));
  const hasAnyValue = columns.some((column) => !isEmptyExecutiveValue(row[column]));
  return hasAnyValue && (dimensionColumns.length ? hasDimension : true);
}

export function sanitizePublicTables(tables: DashboardResult['tables']): DashboardResult['tables'] {
  return asArray(tables).map((table) => {
    const title = businessText(table.title);
    const columns = asArray(table.columns).map((column) => businessText(column)).filter(Boolean);
    const proveedorColumn = columns.find((column) => /proveedor/i.test(column));
    const categoriaColumn = columns.find((column) => /categor/i.test(column));
    const montoColumn = columns.find((column) => amountColumnPattern.test(column));
    const requiresProviderCategory = /matriz.*concentraci[oó]n.*proveedor.*categor/i.test(title)
      || Boolean(proveedorColumn && categoriaColumn && montoColumn);

    const rows = asArray(table.rows).map((row) => {
      const record = row as Record<string, unknown>;
      return columns.reduce<Record<string, unknown>>((cleaned, column) => {
        cleaned[column] = isEmptyExecutiveValue(record[column]) ? '' : record[column];
        return cleaned;
      }, {});
    }).filter((row) => {
      if (requiresProviderCategory) {
        return Boolean(
          proveedorColumn
          && categoriaColumn
          && montoColumn
          && !isEmptyExecutiveValue(row[proveedorColumn])
          && !isEmptyExecutiveValue(row[categoriaColumn])
          && hasNumericExecutiveValue(row[montoColumn]),
        );
      }
      return isUsefulExecutiveRow(row, columns);
    });

    return { ...table, title, columns, rows };
  }).filter((table) => {
    const title = businessText(table.title);
    return title
      && table.columns.length
      && table.rows.length
      && !executiveTableBlocklist.some((pattern) => pattern.test(title));
  }).slice(0, 4);
}

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
    tables: sanitizePublicTables(result.tables),
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
