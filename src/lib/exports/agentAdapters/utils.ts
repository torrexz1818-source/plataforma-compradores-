import type { ExportBlock, ExportBlockType } from '../types';
import { isRenderable, normalizeExportText } from '../isRenderable';

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function firstRenderable(...values: unknown[]) {
  return values.find(isRenderable);
}

export function text(value: unknown, fallback = '') {
  const normalized = normalizeExportText(value);
  return normalized || fallback;
}

export function block(
  id: string,
  type: ExportBlockType,
  title: string,
  data: unknown,
  priority: number,
  description?: string,
  visualHint?: string,
): ExportBlock {
  return { id, type, title, data, priority, description, visualHint };
}

export function tableFromRows(rows: unknown[], title?: string, description?: string) {
  const records = rows.map(asRecord).filter(isRenderable);
  const columns = [...new Set(records.flatMap((row) => Object.keys(row)))];
  return { title, description, columns, rows: records };
}

export function keyValueTable(record: Record<string, unknown>, title?: string) {
  return {
    title,
    columns: ['Campo', 'Valor'],
    rows: Object.entries(record)
      .filter(([, value]) => isRenderable(value))
      .map(([key, value]) => ({
        Campo: key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
        Valor: value,
      })),
  };
}

export function listTable(values: unknown[], valueLabel = 'Detalle', title?: string) {
  return {
    title,
    columns: ['N', valueLabel],
    rows: values.filter(isRenderable).map((value, index) => ({
      N: index + 1,
      [valueLabel]: value,
    })),
  };
}
