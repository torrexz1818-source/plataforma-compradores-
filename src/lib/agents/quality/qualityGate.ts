import type { ExportPayload } from '@/lib/exports/types';
import { sanitizeExportContent } from '@/lib/exports/sanitizeExportContent';
import { collectPayloadQualityIssues } from '@/lib/exports/qualityGuard';
import { isExportPayload } from '@/lib/exports/buildExportPayload';
import type { QualityGateInput, QualityGateReport, QualityIssue } from './qualityTypes';
import { prepareExportPayload, addQualityConsiderationsBlock } from './exportSanitizer';
import { validateMinimumDataByAgent } from './missingDataValidator';
import { validateRelevance } from './relevanceValidator';
import { resolveUserPermissionPolicy } from './userPermissionPolicy';
import { validateVisualReadiness } from './visualReadinessValidator';
import { asArray, asRecord, unique } from './qualityUtils';

function sourceQualityIssues(agentId: string, source: unknown, sourceStats: ReturnType<typeof sanitizeExportContent>['stats']) {
  const issues: QualityIssue[] = [];
  const data = asRecord(source);
  const readiness = asRecord(data.downloadReadiness);
  const traceability = asArray(data.document_traceability).map(asRecord);
  const traceWarnings = traceability.flatMap((item) => asArray(item.publicWarnings ?? item.limitations ?? item.warnings));

  if (readiness.status === 'blocked') {
    issues.push({
      code: 'source-readiness-blocked',
      message: String(readiness.reason || 'Falta informacion critica para generar un entregable confiable.'),
      severity: 'blocking',
      stage: 'Descargables',
      userCanOverride: false,
    });
  } else if (readiness.status === 'ready_with_validation') {
    issues.push({
      code: 'source-readiness-validation',
      message: String(readiness.reason || 'El entregable requiere validacion antes de descargar.'),
      severity: 'recoverable',
      stage: 'Descargables',
      userCanOverride: true,
    });
  }

  if (traceWarnings.length) {
    issues.push({
      code: 'source-document-warnings',
      message: 'El analisis incluye advertencias de lectura, muestreo o extraccion documental.',
      severity: 'warning',
      stage: 'Leyendo archivos',
    });
  }

  if (sourceStats.internalMentionsRemoved > 0) {
    issues.push({
      code: 'source-internal-mentions',
      message: 'Se detecto informacion tecnica interna y sera omitida del archivo final.',
      severity: 'warning',
      stage: 'Descargables',
    });
  }

  if (sourceStats.placeholdersRemoved >= 12) {
    issues.push({
      code: 'source-many-placeholders',
      message: 'Hay demasiados campos sin informacion para mostrarlos celda por celda.',
      severity: 'recoverable',
      stage: 'Descargables',
      suggestion: 'Completa los datos faltantes o continua con una seccion de consideraciones del analisis.',
      userCanOverride: true,
    });
  } else if (sourceStats.placeholdersRemoved >= 4) {
    issues.push({
      code: 'source-placeholder-warning',
      message: 'Hay varios campos incompletos; se limpiaran del entregable final.',
      severity: 'warning',
      stage: 'Descargables',
    });
  }

  if (!agentId.includes('generic') && traceability.some((item) => item.wasTruncated && !asArray(item.warnings).length && !asArray(item.publicWarnings).length)) {
    issues.push({
      code: 'source-truncated-without-context',
      message: 'Algunos archivos fueron recortados durante la lectura y conviene validar la informacion base.',
      severity: 'warning',
      stage: 'Leyendo archivos',
    });
  }

  return issues;
}

function payloadIssuesToQualityIssues(payload: ExportPayload) {
  const issues = collectPayloadQualityIssues(payload);
  const qualityIssues: QualityIssue[] = [
    ...issues.criticalIssues.map((message) => ({
      code: `payload-critical-${message}`,
      message,
      severity: message.includes('Al menos un bloque util') ? 'blocking' as const : 'recoverable' as const,
      stage: 'Descargables',
      userCanOverride: !message.includes('Al menos un bloque util'),
    })),
    ...issues.warnings.map((message) => ({
      code: `payload-warning-${message}`,
      message,
      severity: 'warning' as const,
      stage: 'Descargables',
    })),
    ...issues.suggestions.map((message) => ({
      code: `payload-suggestion-${message}`,
      message,
      severity: 'suggestion' as const,
      stage: 'Descargables',
    })),
  ];
  return { issues: qualityIssues, detectedData: issues.detectedData };
}

function considerationMessages(input: {
  policy: ReturnType<typeof resolveUserPermissionPolicy>;
  options?: QualityGateInput['options'];
}) {
  const messages: string[] = [];
  if (input.options?.qualityPermission?.accepted) {
    messages.push('El usuario confirmo continuar con la informacion disponible y acepto las limitaciones del entregable.');
  }
  if (input.options?.manualQualityInput?.text?.trim()) {
    messages.push(`Informacion complementaria del usuario: ${input.options.manualQualityInput.text.trim()}`);
  }
  if (input.policy.criticalIssues.length || input.policy.warnings.length) {
    messages.push('El analisis se realizo con la informacion disponible en los documentos cargados. Algunas conclusiones pueden estar limitadas por datos complementarios no detectados.');
  }
  input.policy.suggestions.slice(0, 3).forEach((suggestion) => messages.push(suggestion));
  return unique(messages, 6);
}

export function runQualityGate(input: QualityGateInput): QualityGateReport {
  const sourceStats = isExportPayload(input.result)
    ? sanitizeExportContent(input.result).stats
    : sanitizeExportContent(input.result).stats;
  const prepared = prepareExportPayload(input.agentKey, input.result, input.options);
  const payloadQuality = payloadIssuesToQualityIssues(prepared.payload);
  const issues = [
    ...prepared.issues,
    ...payloadQuality.issues,
    ...sourceQualityIssues(prepared.payload.agentId, input.result, sourceStats),
    ...validateRelevance({
      agentKey: input.agentKey ?? prepared.payload.agentId,
      result: input.result,
      payload: prepared.payload,
      userInstructions: input.options?.userInstructions,
    }).issues,
    ...validateMinimumDataByAgent({
      agentKey: input.agentKey ?? prepared.payload.agentId,
      result: input.result,
      payload: prepared.payload,
    }).issues,
    ...validateVisualReadiness(prepared.payload).issues,
  ];
  const policy = resolveUserPermissionPolicy({
    issues,
    options: input.options,
    stats: {
      placeholdersRemoved: sourceStats.placeholdersRemoved + prepared.stats.placeholdersRemoved,
      internalMentionsRemoved: sourceStats.internalMentionsRemoved + prepared.stats.internalMentionsRemoved,
    },
  });
  const sanitizedPayload = addQualityConsiderationsBlock(prepared.payload, considerationMessages({ policy, options: input.options }));

  return {
    status: policy.status,
    score: policy.score,
    criticalIssues: policy.criticalIssues,
    warnings: policy.warnings,
    suggestions: policy.suggestions,
    missingFields: {
      critical: policy.criticalIssues,
      optional: policy.suggestions,
    },
    userCanOverride: policy.userCanOverride,
    requiresUserInput: policy.requiresUserInput,
    sanitizedPayload,
    userMessage: policy.userMessage,
    detectedData: unique([...payloadQuality.detectedData, ...sanitizedPayload.blocks.map((block) => block.type)], 8),
  };
}
