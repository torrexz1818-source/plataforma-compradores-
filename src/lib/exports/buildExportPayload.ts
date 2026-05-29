import type { ExportBuildOptions, ExportPayload } from './types';
import { cleanExportBlocks } from './cleanExportBlocks';
import { isRenderable, normalizeExportText } from './isRenderable';
import {
  dashboardResultToExportPayload,
  proposalComparisonToExportPayload,
  tcoResultToExportPayload,
  termsOfReferenceToExportPayload,
} from './agentAdapters';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function isExportPayload(value: unknown): value is ExportPayload {
  const record = asRecord(value);
  return typeof record.agentId === 'string'
    && typeof record.title === 'string'
    && Array.isArray(record.blocks);
}

function inferAgentId(agentId: string | undefined, result: unknown) {
  const data = asRecord(result);
  if (agentId) return agentId;
  if (data.dashboard_title && Array.isArray(data.kpis)) return 'dashboard_creator';
  if (data.tco_matrix && data.strategic_recommendation) return 'tco_analysis';
  if (data.recommended_supplier && data.comparison_table) return 'proposal_comparison';
  if (data.generated_document && data.quality_check) return 'terms_of_reference';
  return 'generic';
}

function genericResultToExportPayload(agentId: string, result: unknown): ExportPayload {
  const data = asRecord(result);
  const title = normalizeExportText(data.title || data.analysis_title || data.dashboard_title || 'Resultado Nodus IA');
  return {
    agentId,
    title,
    blocks: Object.entries(data)
      .filter(([key, value]) => !['title', 'analysis_title', 'dashboard_title', 'disclaimer'].includes(key) && isRenderable(value))
      .map(([key, value], index) => ({
        id: `generic-${key}`,
        type: index === 0 ? 'summary' : 'table',
        title: key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
        data: value,
        priority: 10 + index * 10,
      })),
  };
}

export function buildExportPayload(agentId: string | undefined, result: unknown, options?: ExportBuildOptions): ExportPayload {
  if (isExportPayload(result)) {
    return {
      ...result,
      blocks: cleanExportBlocks(result.blocks),
    };
  }

  const normalizedAgentId = inferAgentId(agentId, result);
  const payload = normalizedAgentId.includes('dashboard')
    ? dashboardResultToExportPayload(result)
    : normalizedAgentId.includes('tco')
      ? tcoResultToExportPayload(result)
      : normalizedAgentId.includes('proposal') || normalizedAgentId.includes('quote')
        ? proposalComparisonToExportPayload(result)
        : normalizedAgentId.includes('terms')
          ? termsOfReferenceToExportPayload(result, options)
          : genericResultToExportPayload(normalizedAgentId, result);

  return {
    ...payload,
    title: normalizeExportText(payload.title || 'Resultado Nodus IA'),
    blocks: cleanExportBlocks(payload.blocks),
  };
}
