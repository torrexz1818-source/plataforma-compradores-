const PLACEHOLDER_PATTERN =
  /^(dato faltante|n\/a|na|sin informaci[oó]n|no disponible|pendiente|undefined|null|none|nan|no especificado|\[completar[^\]]*\]|\[sugerido[^\]]*\])$/i;

export const FORBIDDEN_EXPORT_KEYWORDS = [
  'Python',
  'backend',
  'frontend',
  'LLM',
  'Open' + 'AI',
  'Claude',
  'modelo de lenguaje',
  'prompt',
  'script',
  'extraccion de PDF',
  'extracción de PDF',
  'extraido del documento',
  'extraído del documento',
  'procesamiento interno',
  'API interna',
  'metadata',
  'source_component',
  'llm_used',
  'dataProfile',
  'data_profile',
  'dashboardPlan',
  'document_traceability',
  'downloadReadiness',
  'qualityWarnings tecnicos',
  'qualityWarnings técnicos',
  'logs',
  'JSON crudo',
];

export const INTERNAL_EXPORT_KEYS = new Set([
  'llm_used',
  'model_provider',
  'model_name',
  'tokens_input',
  'tokens_output',
  'cost_input',
  'cost_output',
  'cost_total',
  'latency_ms',
  'dataProfile',
  'data_profile',
  'dashboardPlan',
  'document_traceability',
  'downloadReadiness',
  'source_component',
  'pdf_available',
  'metadata',
  'qualityWarnings',
  'logs',
]);

export function normalizeExportText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function isPlaceholderText(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return Number.isNaN(value);
  const text = normalizeExportText(value);
  return !text || PLACEHOLDER_PATTERN.test(text);
}

function normalizeForKeyword(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function containsForbiddenExportTerm(value: unknown) {
  const text = normalizeForKeyword(normalizeExportText(value));
  return FORBIDDEN_EXPORT_KEYWORDS.some((term) => {
    const normalizedTerm = escapeRegex(normalizeForKeyword(term));
    return new RegExp(`(^|[^a-z0-9_])${normalizedTerm}($|[^a-z0-9_])`, 'i').test(text);
  });
}

export function isInternalExportKey(key: string) {
  return INTERNAL_EXPORT_KEYS.has(key) || containsForbiddenExportTerm(key);
}

export function isRenderable(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return !isPlaceholderText(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some(isRenderable);
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).some(isRenderable);
  return Boolean(value);
}
