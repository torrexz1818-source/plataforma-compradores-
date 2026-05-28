export type DeliverableAgentKey =
  | 'dashboard_creator'
  | 'proposal_comparison'
  | 'terms_of_reference'
  | 'tco_analysis'
  | 'generic';

export type DeliverableQualityStatus = 'approved' | 'approved_with_warnings' | 'blocked';

export type DeliverableQualityReport = {
  status: DeliverableQualityStatus;
  score: number;
  criticalIssues: string[];
  warnings: string[];
  suggestions: string[];
  missingFields: {
    critical: string[];
    optional: string[];
  };
  sanitizedContent: Record<string, unknown>;
  userMessage: string;
  detectedData: string[];
};

const PLACEHOLDER_PATTERN = /^(dato faltante|n\/a|na|sin informaci[oó]n|no disponible|pendiente|undefined|null|none|nan|no especificado|\[completar[^\]]*\]|\[sugerido[^\]]*\])$/i;
const INTERNAL_TEXT_PATTERN = /\b(python|llm|prompt|script|modelo|model_provider|model_name|tokens?|backend|data\s*profile|dashboardplan|candidatefields|procesamiento t[eé]cnico|extracci[oó]n de documentos|json crudo|funci[oó]n interna)\b/i;
const INTERNAL_KEYS = new Set([
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
  'source_component',
  'pdf_available',
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

export function isMissingPlaceholder(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return Number.isNaN(value);
  const text = normalizeText(value);
  return !text || PLACEHOLDER_PATTERN.test(text);
}

function hasBusinessValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasBusinessValue);
  if (value && typeof value === 'object') return Object.values(value).some(hasBusinessValue);
  return !isMissingPlaceholder(value);
}

function isInternalKey(key: string) {
  return INTERNAL_KEYS.has(key) || INTERNAL_TEXT_PATTERN.test(key);
}

function sanitizeString(value: string) {
  const text = value.trim();
  if (!text || PLACEHOLDER_PATTERN.test(text) || INTERNAL_TEXT_PATTERN.test(text)) return '';
  return text;
}

function sanitizeTable(table: Record<string, unknown>, warnings: string[]) {
  const columns = asArray(table.columns).map((item) => sanitizeString(String(item ?? ''))).filter(Boolean);
  const sourceRows = asArray(table.rows).map(asRecord);
  if (!columns.length || !sourceRows.length) return undefined;

  let placeholderCount = 0;
  const rows = sourceRows.map((row) => {
    const cleaned: Record<string, unknown> = {};
    columns.forEach((column) => {
      const value = row[column];
      if (isMissingPlaceholder(value)) {
        placeholderCount += 1;
        cleaned[column] = '';
      } else {
        cleaned[column] = sanitizeValue(value, warnings);
      }
    });
    return cleaned;
  });

  const usefulColumns = columns.filter((column) => rows.some((row) => hasBusinessValue(row[column])));
  const usefulRows = rows
    .map((row) => usefulColumns.reduce<Record<string, unknown>>((acc, column) => ({ ...acc, [column]: row[column] }), {}))
    .filter(hasBusinessValue);

  if (placeholderCount >= 6) {
    warnings.push('Algunos campos complementarios no fueron incluidos por falta de informacion disponible.');
  }
  if (!usefulColumns.length || !usefulRows.length) return undefined;

  return {
    ...table,
    title: sanitizeString(String(table.title ?? 'Tabla')),
    description: sanitizeString(String(table.description ?? '')),
    columns: usefulColumns,
    rows: usefulRows,
  };
}

function sanitizeValue(value: unknown, warnings: string[]): unknown {
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number') return Number.isNaN(value) ? '' : value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, warnings)).filter(hasBusinessValue);
  }
  if (!value || typeof value !== 'object') return isMissingPlaceholder(value) ? '' : value;

  const record = asRecord(value);
  if (Array.isArray(record.columns) && Array.isArray(record.rows)) {
    return sanitizeTable(record, warnings) ?? {};
  }

  return Object.entries(record).reduce<Record<string, unknown>>((acc, [key, item]) => {
    if (isInternalKey(key)) return acc;
    const sanitized = sanitizeValue(item, warnings);
    if (hasBusinessValue(sanitized)) acc[key] = sanitized;
    return acc;
  }, {});
}

export function sanitizeMissingFieldsForExport(content: unknown) {
  const warnings: string[] = [];
  const sanitizedContent = asRecord(sanitizeValue(content, warnings));
  const uniqueWarnings = [...new Set(warnings)];
  if (uniqueWarnings.length) {
    sanitizedContent.consideraciones_del_analisis = [
      ...asArray(sanitizedContent.consideraciones_del_analisis),
      ...uniqueWarnings,
    ];
  }
  return sanitizedContent;
}

function collectStats(value: unknown) {
  const stats = { placeholders: 0, internalMentions: 0, totalFields: 0 };
  const walk = (item: unknown, key = '') => {
    if (isInternalKey(key)) stats.internalMentions += 1;
    if (Array.isArray(item)) {
      item.forEach((child) => walk(child));
      return;
    }
    if (item && typeof item === 'object') {
      Object.entries(asRecord(item)).forEach(([childKey, child]) => walk(child, childKey));
      return;
    }
    stats.totalFields += 1;
    if (isMissingPlaceholder(item)) stats.placeholders += 1;
    if (typeof item === 'string' && INTERNAL_TEXT_PATTERN.test(item)) stats.internalMentions += 1;
  };
  walk(value);
  return stats;
}

function addUnique(target: string[], values: unknown[]) {
  values.map((value) => normalizeText(value)).filter(Boolean).forEach((value) => {
    if (!target.includes(value)) target.push(value);
  });
}

function auditDashboard(result: Record<string, unknown>, critical: string[], warnings: string[], suggestions: string[], detected: string[]) {
  const kpis = asArray(result.kpis);
  const charts = asArray(result.charts);
  const tables = asArray(result.tables);
  const insights = asArray(result.insights);
  const recommendations = asArray(result.recommendations);
  if (kpis.length) detected.push(`${kpis.length} KPI(s)`);
  if (charts.length) detected.push(`${charts.length} grafico(s)`);
  if (tables.length) detected.push(`${tables.length} tabla(s)`);
  if (!kpis.length) critical.push('KPIs ejecutivos del dashboard');
  if (!charts.length && !tables.length) critical.push('Graficos o tablas utiles para interpretar datos');
  if (!insights.length && !recommendations.length) warnings.push('El dashboard no incluye suficientes insights o recomendaciones accionables.');
  addUnique(suggestions, asArray(result.missing_information));
  addUnique(suggestions, asArray(result.qualityWarnings));
}

function auditProposal(result: Record<string, unknown>, critical: string[], warnings: string[], suggestions: string[], detected: string[]) {
  const suppliers = asArray(result.suppliers).map(asRecord);
  const comparableSuppliers = suppliers.filter((supplier) => normalizeText(supplier.supplier_name));
  if (comparableSuppliers.length) detected.push(`${comparableSuppliers.length} proveedor(es)`);
  if (comparableSuppliers.length < 2) critical.push('Al menos dos proveedores con nombre identificable');
  const suppliersWithoutPrice = comparableSuppliers.filter((supplier) => isMissingPlaceholder(supplier.total_amount));
  if (suppliersWithoutPrice.length === comparableSuppliers.length) warnings.push('No se detectaron precios comparables suficientes; el ranking puede no ser concluyente.');
  if (!normalizeText(result.executive_summary)) critical.push('Resumen ejecutivo del comparativo');
  if (!asArray(result.comparison_table).length) critical.push('Tabla comparativa de criterios');
  addUnique(suggestions, asArray(result.missing_information));
  addUnique(suggestions, asArray(result.questions_for_suppliers));
}

function auditTerms(result: Record<string, unknown>, critical: string[], warnings: string[], suggestions: string[], detected: string[]) {
  const document = asRecord(result.generated_document);
  if (document.objective) detected.push('Objeto/objetivo');
  if (document.scope) detected.push('Alcance');
  if (asArray(document.final_deliverables).length) detected.push('Entregables');
  if (!normalizeText(document.objective)) critical.push('Objeto u objetivo del requerimiento');
  if (!normalizeText(document.scope)) critical.push('Alcance del requerimiento');
  if (!asArray(document.final_deliverables).length) critical.push('Entregables esperados');
  if (!asArray(document.evaluation_matrix).length && !asArray(document.evaluation_criteria).length) warnings.push('Faltan criterios de evaluacion detallados.');
  addUnique(suggestions, asArray(result.missing_information));
  addUnique(suggestions, asArray(result.recommended_questions));
}

function auditTco(result: Record<string, unknown>, critical: string[], warnings: string[], suggestions: string[], detected: string[]) {
  const matrix = asArray(result.tco_matrix);
  const ranking = asArray(result.ranking);
  const missing = asArray(result.missing_information);
  if (matrix.length) detected.push('Matriz TCO');
  if (ranking.length) detected.push('Ranking');
  if (normalizeText(asRecord(result.executive_summary).final_recommendation)) detected.push('Recomendacion ejecutiva');
  if (!matrix.length && !asArray(result.financial_model).length) critical.push('Matriz de costos o modelo financiero TCO');
  if (!ranking.length) critical.push('Ranking o comparacion clara de alternativas');
  if (missing.length) warnings.push('El analisis TCO tiene datos financieros o supuestos pendientes de validar.');
  addUnique(suggestions, missing);
  addUnique(suggestions, asArray(result.questions_for_user_or_suppliers));
  addUnique(suggestions, asArray(result.assumptions_and_limits));
}

export function auditDeliverableBeforeDownload(params: {
  agentKey?: string;
  result: unknown;
}): DeliverableQualityReport {
  const agentKey = (params.agentKey || 'generic') as DeliverableAgentKey;
  const result = asRecord(params.result);
  const criticalIssues: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  const detectedData: string[] = [];
  const stats = collectStats(result);

  if (!Object.keys(result).length) criticalIssues.push('Contenido analitico del entregable');
  if (stats.internalMentions > 0) warnings.push('Se detecto informacion tecnica interna y sera omitida del archivo final.');
  if (stats.placeholders >= 12) warnings.push('Hay varios campos sin informacion; se resumiran como consideraciones y no se repetiran en tablas.');
  if (!normalizeText(result.executive_summary) && !normalizeText(asRecord(result.executive_summary).final_recommendation) && !normalizeText(result.final_recommendation)) {
    warnings.push('Conviene reforzar el resumen ejecutivo o la interpretacion final.');
  }

  if (agentKey.includes('dashboard')) auditDashboard(result, criticalIssues, warnings, suggestions, detectedData);
  else if (agentKey.includes('proposal') || agentKey.includes('quote')) auditProposal(result, criticalIssues, warnings, suggestions, detectedData);
  else if (agentKey.includes('terms')) auditTerms(result, criticalIssues, warnings, suggestions, detectedData);
  else if (agentKey.includes('tco')) auditTco(result, criticalIssues, warnings, suggestions, detectedData);

  const sanitizedContent = sanitizeMissingFieldsForExport(result);
  addUnique(warnings, asArray(sanitizedContent.consideraciones_del_analisis));
  const missingOptional = [...new Set(suggestions)].slice(0, 8);
  const uniqueCritical = [...new Set(criticalIssues)].slice(0, 8);
  const uniqueWarnings = [...new Set(warnings)].slice(0, 8);
  const status: DeliverableQualityStatus = uniqueCritical.length
    ? 'blocked'
    : uniqueWarnings.length || missingOptional.length
      ? 'approved_with_warnings'
      : 'approved';
  const penalty = uniqueCritical.length * 25 + uniqueWarnings.length * 8 + Math.min(stats.placeholders, 20);
  const score = status === 'blocked' ? Math.min(69, Math.max(25, 100 - penalty)) : Math.max(status === 'approved' ? 90 : 70, 100 - penalty);

  return {
    status,
    score,
    criticalIssues: uniqueCritical,
    warnings: uniqueWarnings,
    suggestions: missingOptional,
    missingFields: {
      critical: uniqueCritical,
      optional: missingOptional,
    },
    sanitizedContent,
    detectedData: [...new Set(detectedData)].slice(0, 6),
    userMessage: status === 'approved'
      ? 'Tu entregable paso la revision de calidad y esta listo para descargar.'
      : status === 'approved_with_warnings'
        ? 'Tu entregable puede generarse con la informacion disponible. Para mejorar la precision, puedes agregar informacion adicional antes de descargar.'
        : 'Antes de generar el archivo final, necesitamos completar algunos datos clave para evitar un entregable incompleto o poco profesional.',
  };
}

export function assertDeliverableCanDownload(report: DeliverableQualityReport) {
  if (report.status === 'blocked') {
    throw new Error(report.userMessage);
  }
}
