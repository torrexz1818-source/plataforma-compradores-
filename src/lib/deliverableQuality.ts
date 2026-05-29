import {
  assertDeliverableCanDownload as assertExportPayloadCanDownload,
  auditDeliverableBeforeDownload as auditExportPayloadBeforeDownload,
  buildExportPayload,
  type ExportAuditStatus,
  type ExportBuildOptions,
  type ExportPayload,
} from '@/lib/exports';

export type DeliverableAgentKey =
  | 'dashboard_creator'
  | 'proposal_comparison'
  | 'terms_of_reference'
  | 'tco_analysis'
  | 'generic';

export type DeliverableQualityStatus = ExportAuditStatus;

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
  sanitizedPayload: ExportPayload;
  userMessage: string;
  detectedData: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function sanitizeMissingFieldsForExport(content: unknown, agentKey = 'generic', options?: ExportBuildOptions) {
  return buildExportPayload(agentKey, content, options) as unknown as Record<string, unknown>;
}

export function auditDeliverableBeforeDownload(params: {
  agentKey?: string;
  result: unknown;
  options?: ExportBuildOptions;
}): DeliverableQualityReport {
  const report = auditExportPayloadBeforeDownload({
    agentKey: params.agentKey,
    result: params.result,
    options: params.options,
  });

  return {
    ...report,
    sanitizedContent: asRecord(report.sanitizedPayload),
  };
}

export function assertDeliverableCanDownload(report: DeliverableQualityReport) {
  assertExportPayloadCanDownload(report);
}
