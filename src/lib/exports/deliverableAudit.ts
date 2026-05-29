import { cleanExportBlocks } from './cleanExportBlocks';
import { collectPayloadQualityIssues } from './qualityGuard';
import { sanitizeExportContent } from './sanitizeExportContent';
import type { ExportAuditReport, ExportBuildOptions, ExportPayload } from './types';
import { buildExportPayload, isExportPayload } from './buildExportPayload';
import { isRenderable } from './isRenderable';

function sanitizePayload(payload: ExportPayload): ExportPayload {
  const title = sanitizeExportContent(payload.title).value;
  const subtitle = sanitizeExportContent(payload.subtitle).value;
  const blocks = payload.blocks.map((block) => ({
    ...block,
    title: sanitizeExportContent(block.title).value as string | undefined,
    description: sanitizeExportContent(block.description).value as string | undefined,
    data: sanitizeExportContent(block.data).value,
  }));

  return {
    agentId: payload.agentId,
    title: typeof title === 'string' && title ? title : payload.title || 'Resultado Nodus IA',
    subtitle: typeof subtitle === 'string' ? subtitle : undefined,
    blocks: cleanExportBlocks(blocks),
  };
}

function collectSanitizeStats(payload: ExportPayload) {
  return sanitizeExportContent({
    title: payload.title,
    subtitle: payload.subtitle,
    blocks: payload.blocks.map((block) => ({
      id: block.id,
      type: block.type,
      title: block.title,
      data: block.data,
    })),
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function placeholderCount(value: unknown) {
  const text = JSON.stringify(value ?? '').toLowerCase();
  return (text.match(/dato faltante|no especificado|\[completar|pendiente|null/g) ?? []).length;
}

function collectSourceQualityIssues(agentId: string, source: unknown) {
  const data = asRecord(source);
  const criticalIssues: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  const readiness = asRecord(data.downloadReadiness);
  const traceability = asArray(data.document_traceability).map(asRecord);
  const traceWarnings = traceability.flatMap((item) => asArray(item.publicWarnings ?? item.limitations ?? item.warnings));
  const truncatedWithoutContext = traceability.some((item) => item.wasTruncated && !asArray(item.warnings).length && !asArray(item.publicWarnings).length);
  const missingCount = placeholderCount(source);

  if (readiness.status === 'blocked') {
    criticalIssues.push(String(readiness.reason || 'Falta informacion critica para generar un entregable confiable.'));
  } else if (readiness.status === 'ready_with_validation') {
    warnings.push(String(readiness.reason || 'El entregable requiere validacion de advertencias antes de decidir.'));
  }

  if (truncatedWithoutContext) {
    warnings.push('Hay archivos recortados sin una advertencia documental clara.');
  }
  if (traceWarnings.length) {
    warnings.push('El analisis incluye advertencias de lectura o muestreo documental.');
  }
  if (missingCount >= 20) {
    criticalIssues.push('El resultado contiene demasiados campos sin informacion para generar un entregable profesional.');
  } else if (missingCount >= 8) {
    warnings.push('Hay varios campos sin informacion; conviene completar datos antes de descargar.');
  }

  if (agentId.includes('tco')) {
    const alternatives = asArray(data.detected_alternatives).length || asArray(asRecord(data.scorecard).totals).length || asArray(data.ranking).length;
    if (alternatives < 2) criticalIssues.push('TCO sin al menos dos alternativas comparables con evidencia.');
  }

  if (agentId.includes('proposal')) {
    const suppliers = asArray(data.suppliers).map(asRecord);
    if (suppliers.length < 2) criticalIssues.push('Comparativo sin al menos dos proveedores comparables.');
    const hasEvidence = suppliers.some((supplier) => asArray(supplier.source_evidence).length || supplier.source_file);
    if (traceability.length && !hasEvidence) warnings.push('El comparativo no incluye evidencia minima por proveedor.');
  }

  if (agentId.includes('dashboard')) {
    const profile = asRecord(data.data_profile ?? data.dataProfile);
    const rowsDetected = Number(profile.rows_detected ?? 0);
    const sampleRows = asArray(profile.rowSamples).length;
    if (rowsDetected > 300 && sampleRows > 0 && sampleRows < 5) {
      warnings.push('El dashboard parece basarse en una muestra insuficiente para el volumen de datos.');
    }
    if (!asArray(data.kpis).length || (!asArray(data.charts).length && !asArray(data.tables).length)) {
      criticalIssues.push('Dashboard sin KPIs y visualizaciones o tablas suficientes.');
    }
  }

  if (agentId.includes('terms')) {
    const document = asRecord(data.generated_document);
    if (!document.objective || !document.scope) criticalIssues.push('TDR con objetivo o alcance critico incompleto.');
    if (!asArray(document.final_deliverables).length) warnings.push('TDR sin entregables claros para proveedores.');
    if (!asArray(document.evaluation_matrix).length && !asArray(document.evaluation_criteria).length) {
      warnings.push('TDR sin criterios de evaluacion suficientes.');
    }
  }

  return { criticalIssues, warnings, suggestions };
}

export function auditDeliverableBeforeDownload(input: ExportPayload | {
  agentKey?: string;
  result: unknown;
  options?: ExportBuildOptions;
}): ExportAuditReport {
  const sourceStats = isExportPayload(input)
    ? collectSanitizeStats(input).stats
    : sanitizeExportContent(input.result).stats;
  const rawPayload = isExportPayload(input)
    ? input
    : buildExportPayload(input.agentKey, input.result, input.options);
  const payloadStats = collectSanitizeStats(rawPayload).stats;
  const stats = {
    placeholdersRemoved: sourceStats.placeholdersRemoved + payloadStats.placeholdersRemoved,
    internalMentionsRemoved: sourceStats.internalMentionsRemoved + payloadStats.internalMentionsRemoved,
    totalFields: sourceStats.totalFields + payloadStats.totalFields,
  };
  const sanitizedPayload = sanitizePayload(rawPayload);
  const baseIssues = collectPayloadQualityIssues(sanitizedPayload);
  const sourceIssues = collectSourceQualityIssues(
    sanitizedPayload.agentId,
    isExportPayload(input) ? input : input.result,
  );
  const criticalIssues = [...baseIssues.criticalIssues];
  const warnings = [...baseIssues.warnings];

  if (!sanitizedPayload.blocks.length || !sanitizedPayload.blocks.some((block) => isRenderable(block.data))) {
    criticalIssues.push('Al menos un bloque util para el usuario');
  }
  if (stats.internalMentionsRemoved > 0) {
    warnings.push('Se detecto informacion tecnica interna y sera omitida del archivo final.');
  }
  if (stats.placeholdersRemoved >= 4) {
    warnings.push('Hay varios campos sin informacion; se resumiran como consideraciones y no se repetiran en tablas.');
  }
  criticalIssues.push(...sourceIssues.criticalIssues);
  warnings.push(...sourceIssues.warnings);

  const uniqueCritical = [...new Set(criticalIssues)].slice(0, 8);
  const uniqueWarnings = [...new Set(warnings)].slice(0, 8);
  const suggestions = [...new Set([...baseIssues.suggestions, ...sourceIssues.suggestions])].slice(0, 8);
  const status = uniqueCritical.length
    ? 'blocked'
    : uniqueWarnings.length || suggestions.length
      ? 'approved_with_warnings'
      : 'approved';
  const penalty = uniqueCritical.length * 25 + uniqueWarnings.length * 8 + Math.min(stats.placeholdersRemoved, 20);
  const score = status === 'blocked'
    ? Math.min(69, Math.max(25, 100 - penalty))
    : Math.max(status === 'approved' ? 90 : 70, 100 - penalty);

  return {
    status,
    score,
    criticalIssues: uniqueCritical,
    warnings: uniqueWarnings,
    suggestions,
    missingFields: {
      critical: uniqueCritical,
      optional: suggestions,
    },
    sanitizedPayload,
    detectedData: baseIssues.detectedData,
    userMessage: status === 'approved'
      ? 'Tu entregable paso la revision de calidad y esta listo para descargar.'
      : status === 'approved_with_warnings'
        ? 'Tu entregable puede generarse con la informacion disponible. Para mejorar la precision, puedes agregar informacion adicional antes de descargar.'
        : 'Antes de generar el archivo final, necesitamos completar algunos datos clave para evitar un entregable incompleto o poco profesional.',
  };
}

export function assertDeliverableCanDownload(report: ExportAuditReport) {
  if (report.status === 'blocked') {
    throw new Error(report.userMessage);
  }
}
