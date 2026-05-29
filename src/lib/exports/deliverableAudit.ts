import { runQualityGate } from '@/lib/agents/quality';
import type { ExportAuditReport, ExportBuildOptions, ExportPayload } from './types';

export function auditDeliverableBeforeDownload(input: ExportPayload | {
  agentKey?: string;
  result: unknown;
  options?: ExportBuildOptions;
}): ExportAuditReport {
  if ('agentId' in input && 'blocks' in input) {
    return runQualityGate({ agentKey: input.agentId, result: input }) as ExportAuditReport;
  }

  return runQualityGate({
    agentKey: input.agentKey,
    result: input.result,
    options: input.options,
  }) as ExportAuditReport;
}

export function assertDeliverableCanDownload(report: ExportAuditReport) {
  if (report.status === 'blocked' || report.status === 'user_permission_required') {
    throw new Error(report.userMessage);
  }
}
