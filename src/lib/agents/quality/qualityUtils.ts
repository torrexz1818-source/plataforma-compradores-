import { isRenderable, normalizeExportText } from '@/lib/exports/isRenderable';

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function unique(values: string[], limit = 12) {
  return [...new Set(values.map((value) => normalizeExportText(value)).filter(Boolean))].slice(0, limit);
}

export function normalizeForSearch(value: unknown) {
  return normalizeExportText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function jsonText(value: unknown) {
  try {
    return normalizeForSearch(JSON.stringify(value ?? ''));
  } catch {
    return normalizeForSearch(String(value ?? ''));
  }
}

export function countMatches(text: string, patterns: RegExp[]) {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

export function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function rowCount(value: unknown): number {
  if (Array.isArray(value)) return value.filter(isRenderable).length;
  const record = asRecord(value);
  if (Array.isArray(record.rows)) return record.rows.filter(isRenderable).length;
  return isRenderable(value) ? 1 : 0;
}

export function tableShape(value: unknown) {
  const record = asRecord(value);
  const columns = asArray(record.columns).map((item) => normalizeExportText(item)).filter(Boolean);
  const rows = asArray(record.rows).map(asRecord).filter(isRenderable);
  return { columns, rows };
}

export function pushIssue(
  issues: Array<{ code: string; message: string; severity: 'blocking' | 'recoverable' | 'warning' | 'suggestion'; field?: string; stage?: string; suggestion?: string; userCanOverride?: boolean }>,
  issue: { code: string; message: string; severity: 'blocking' | 'recoverable' | 'warning' | 'suggestion'; field?: string; stage?: string; suggestion?: string; userCanOverride?: boolean },
) {
  if (!issues.some((item) => item.code === issue.code && item.message === issue.message)) {
    issues.push(issue);
  }
}
