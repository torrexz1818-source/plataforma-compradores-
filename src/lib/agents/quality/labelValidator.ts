import type { ExportBlock, ExportPayload } from '@/lib/exports/types';
import { isRenderable, normalizeExportText } from '@/lib/exports/isRenderable';
import type { QualityIssue } from './qualityTypes';
import { asArray, asRecord, unique } from './qualityUtils';

const BAD_LABEL_PATTERN =
  /^(dato\s*\d+|campo\s*\d+|informaci[oó]n|dato faltante|n\/a|na|sin informaci[oó]n|no disponible|pendiente|undefined|null|none|nan|\[completar[^\]]*\]|\[sugerido[^\]]*\])$/i;

const blockFallbacks: Record<string, string> = {
  summary: 'Resumen ejecutivo',
  kpi: 'Indicadores principales',
  chart: 'Visualizaciones',
  table: 'Tabla de analisis',
  insight: 'Hallazgos',
  risk: 'Riesgos',
  recommendation: 'Recomendaciones',
  decision: 'Decision ejecutiva',
  matrix: 'Matriz de evaluacion',
  timeline: 'Cronograma',
  dashboard_filter: 'Filtros',
  alert: 'Consideraciones del analisis',
  ranking: 'Ranking',
};

const columnFallbacks = ['Concepto', 'Valor', 'Detalle', 'Importe', 'Observacion', 'Estado', 'Fuente'];

function isBadLabel(value: unknown) {
  const text = normalizeExportText(value);
  if (!text) return true;
  if (BAD_LABEL_PATTERN.test(text)) return true;
  if (/^(undefined|null|nan|n\/a)$/i.test(text)) return true;
  return false;
}

function summarizeLongLabel(label: string) {
  const firstClause = label.split(/[.;:|]/)[0]?.trim();
  const candidate = firstClause && firstClause.length >= 12 ? firstClause : label;
  return candidate.length > 80 ? `${candidate.slice(0, 77).trim()}...` : candidate;
}

function cleanLabel(value: unknown, fallback: string, issues: QualityIssue[], code: string) {
  const label = normalizeExportText(value);
  if (isBadLabel(label)) {
    issues.push({
      code,
      message: `Se ajusto un label no profesional en "${fallback}".`,
      severity: 'warning',
      field: fallback,
    });
    return fallback;
  }
  if (label.length > 80) {
    issues.push({
      code,
      message: `Se resumio un label demasiado largo: "${label.slice(0, 60)}...".`,
      severity: 'warning',
      field: fallback,
    });
    return summarizeLongLabel(label);
  }
  return label;
}

function uniqueLabel(label: string, used: Set<string>, fallbackIndex: number) {
  if (!used.has(label)) {
    used.add(label);
    return label;
  }
  const fallback = columnFallbacks[fallbackIndex % columnFallbacks.length];
  const next = used.has(fallback) ? `${fallback} adicional` : fallback;
  used.add(next);
  return next;
}

function sanitizeTable(record: Record<string, unknown>, issues: QualityIssue[]) {
  const rawColumns = asArray(record.columns).map((column) => normalizeExportText(column)).filter(Boolean);
  const rows = asArray(record.rows).map(asRecord);
  const used = new Set<string>();
  const columnMap = new Map<string, string>();
  const cleanedColumns = rawColumns.map((column, index) => {
    const cleaned = cleanLabel(column, columnFallbacks[index % columnFallbacks.length], issues, 'label-table-column');
    const uniqueCleaned = uniqueLabel(cleaned, used, index);
    columnMap.set(column, uniqueCleaned);
    return uniqueCleaned;
  });
  const cleanedRows = rows.map((row) => {
    const nextRow: Record<string, unknown> = {};
    rawColumns.forEach((column) => {
      const target = columnMap.get(column);
      if (target && isRenderable(row[column])) nextRow[target] = row[column];
    });
    return nextRow;
  }).filter(isRenderable);

  return {
    ...record,
    title: cleanLabel(record.title ?? 'Tabla de analisis', 'Tabla de analisis', issues, 'label-table-title'),
    description: record.description,
    columns: cleanedColumns.filter((column) => cleanedRows.some((row) => isRenderable(row[column]))),
    rows: cleanedRows,
  };
}

function sanitizeChart(chart: Record<string, unknown>, issues: QualityIssue[]) {
  const data = asArray(chart.data).map(asRecord).map((point, index) => {
    const label = cleanLabel(point.label, `Categoria ${index + 1}`, issues, 'label-chart-point');
    return { ...point, label };
  }).filter((point) => isRenderable(point.label) && isRenderable(point.value));
  return {
    ...chart,
    title: cleanLabel(chart.title ?? 'Visualizacion', 'Visualizacion', issues, 'label-chart-title'),
    x_axis: chart.x_axis ? cleanLabel(chart.x_axis, 'Eje horizontal', issues, 'label-chart-axis') : chart.x_axis,
    y_axis: chart.y_axis ? cleanLabel(chart.y_axis, 'Eje vertical', issues, 'label-chart-axis') : chart.y_axis,
    data,
  };
}

function sanitizeData(value: unknown, issues: QualityIssue[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeData(item, issues)).filter(isRenderable);
  }

  const record = asRecord(value);
  if (!Object.keys(record).length) return value;

  if (Array.isArray(record.columns) && Array.isArray(record.rows)) {
    return sanitizeTable(record, issues);
  }

  if (Array.isArray(record.data) && ('chart_id' in record || 'x_axis' in record || 'y_axis' in record)) {
    return sanitizeChart(record, issues);
  }

  return Object.fromEntries(
    Object.entries(record)
      .map(([key, item]) => [key, sanitizeData(item, issues)])
      .filter(([, item]) => isRenderable(item)),
  );
}

export function sanitizePayloadLabels(payload: ExportPayload) {
  const issues: QualityIssue[] = [];
  const usedTitles = new Set<string>();
  const blocks = payload.blocks.map((block): ExportBlock => {
    const fallback = blockFallbacks[block.type] ?? 'Seccion del entregable';
    const title = uniqueLabel(cleanLabel(block.title, fallback, issues, 'label-block-title'), usedTitles, block.priority);
    return {
      ...block,
      title,
      description: block.description ? cleanLabel(block.description, title, issues, 'label-block-description') : block.description,
      data: sanitizeData(block.data, issues),
    };
  }).filter((block) => isRenderable(block.data));

  return {
    payload: {
      ...payload,
      title: cleanLabel(payload.title, 'Resultado Nodus IA', issues, 'label-payload-title'),
      subtitle: payload.subtitle ? cleanLabel(payload.subtitle, 'Contexto del analisis', issues, 'label-payload-subtitle') : payload.subtitle,
      blocks,
    },
    issues: unique(issues.map((issue) => issue.message), 8).map((message) => ({
      code: 'label-cleanup',
      message,
      severity: 'warning' as const,
    })),
  };
}
