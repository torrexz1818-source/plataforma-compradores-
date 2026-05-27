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

export function uniqueId(prefix: string, index: number) {
  return `${prefix}-${index}`;
}
