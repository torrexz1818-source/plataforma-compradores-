import {
  containsForbiddenExportTerm,
  isInternalExportKey,
  isPlaceholderText,
  isRenderable,
  normalizeExportText,
} from './isRenderable';

export type SanitizeStats = {
  placeholdersRemoved: number;
  internalMentionsRemoved: number;
  totalFields: number;
};

export type SanitizedValue = {
  value: unknown;
  stats: SanitizeStats;
};

function emptyStats(): SanitizeStats {
  return { placeholdersRemoved: 0, internalMentionsRemoved: 0, totalFields: 0 };
}

function mergeStats(target: SanitizeStats, source: SanitizeStats) {
  target.placeholdersRemoved += source.placeholdersRemoved;
  target.internalMentionsRemoved += source.internalMentionsRemoved;
  target.totalFields += source.totalFields;
}

function looksLikeTable(record: Record<string, unknown>) {
  return Array.isArray(record.columns) && Array.isArray(record.rows);
}

function sanitizeTable(record: Record<string, unknown>): SanitizedValue {
  const stats = emptyStats();
  const columns = (record.columns as unknown[])
    .map((column) => sanitizeExportContent(column))
    .filter((entry) => {
      mergeStats(stats, entry.stats);
      return isRenderable(entry.value);
    })
    .map((entry) => normalizeExportText(entry.value));
  const rows = (record.rows as unknown[])
    .map((row) => sanitizeExportContent(row))
    .filter((entry) => {
      mergeStats(stats, entry.stats);
      return isRenderable(entry.value);
    })
    .map((entry) => entry.value as Record<string, unknown>);

  const usefulColumns = columns.filter((column) => rows.some((row) => isRenderable(row[column])));
  const usefulRows = rows
    .map((row) => usefulColumns.reduce<Record<string, unknown>>((acc, column) => {
      if (isRenderable(row[column])) acc[column] = row[column];
      return acc;
    }, {}))
    .filter(isRenderable);

  if (!usefulColumns.length || !usefulRows.length) {
    return { value: undefined, stats };
  }

  return {
    value: {
      ...record,
      title: sanitizeExportContent(record.title).value,
      description: sanitizeExportContent(record.description).value,
      columns: usefulColumns,
      rows: usefulRows,
    },
    stats,
  };
}

export function sanitizeExportContent(value: unknown): SanitizedValue {
  const stats = emptyStats();

  if (value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value))) {
    stats.placeholdersRemoved += 1;
    stats.totalFields += 1;
    return { value: undefined, stats };
  }

  if (typeof value === 'string') {
    stats.totalFields += 1;
    const text = normalizeExportText(value);
    if (isPlaceholderText(text)) {
      stats.placeholdersRemoved += 1;
      return { value: undefined, stats };
    }
    if (containsForbiddenExportTerm(text)) {
      stats.internalMentionsRemoved += 1;
      return { value: undefined, stats };
    }
    return { value: text, stats };
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    stats.totalFields += 1;
    return { value, stats };
  }

  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => sanitizeExportContent(item))
      .filter((entry) => {
        mergeStats(stats, entry.stats);
        return isRenderable(entry.value);
      })
      .map((entry) => entry.value);
    return { value: cleaned.length ? cleaned : undefined, stats };
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (looksLikeTable(record)) return sanitizeTable(record);

    const cleaned = Object.entries(record).reduce<Record<string, unknown>>((acc, [key, item]) => {
      if (isInternalExportKey(key)) {
        stats.internalMentionsRemoved += 1;
        return acc;
      }
      const entry = sanitizeExportContent(item);
      mergeStats(stats, entry.stats);
      if (isRenderable(entry.value)) acc[key] = entry.value;
      return acc;
    }, {});

    return { value: isRenderable(cleaned) ? cleaned : undefined, stats };
  }

  return { value: undefined, stats };
}
