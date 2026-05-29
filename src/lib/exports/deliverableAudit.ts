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

  const uniqueCritical = [...new Set(criticalIssues)].slice(0, 8);
  const uniqueWarnings = [...new Set(warnings)].slice(0, 8);
  const suggestions = [...new Set(baseIssues.suggestions)].slice(0, 8);
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
