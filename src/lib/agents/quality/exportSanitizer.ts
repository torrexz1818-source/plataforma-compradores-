import { buildExportPayload } from '@/lib/exports/buildExportPayload';
import { cleanExportBlocks } from '@/lib/exports/cleanExportBlocks';
import { sanitizeExportContent } from '@/lib/exports/sanitizeExportContent';
import type { ExportBuildOptions, ExportPayload } from '@/lib/exports/types';
import { isRenderable } from '@/lib/exports/isRenderable';
import { sanitizePayloadLabels } from './labelValidator';
import type { QualityIssue } from './qualityTypes';

export type PreparedExportPayload = {
  payload: ExportPayload;
  issues: QualityIssue[];
  stats: {
    placeholdersRemoved: number;
    internalMentionsRemoved: number;
    totalFields: number;
  };
};

export function prepareExportPayload(agentKey: string | undefined, result: unknown, options?: ExportBuildOptions): PreparedExportPayload {
  const rawPayload = buildExportPayload(agentKey, result, options);
  const labelResult = sanitizePayloadLabels(rawPayload);
  const sanitized = sanitizeExportContent(labelResult.payload);
  const cleanedValue = sanitized.value && typeof sanitized.value === 'object'
    ? sanitized.value as Partial<ExportPayload>
    : {};
  const payload: ExportPayload = {
    agentId: cleanedValue.agentId ?? labelResult.payload.agentId,
    title: cleanedValue.title ?? labelResult.payload.title,
    subtitle: cleanedValue.subtitle ?? labelResult.payload.subtitle,
    blocks: Array.isArray(cleanedValue.blocks) ? cleanedValue.blocks : labelResult.payload.blocks,
  };

  return {
    payload: {
      ...payload,
      blocks: cleanExportBlocks(payload.blocks),
    },
    issues: labelResult.issues,
    stats: sanitized.stats,
  };
}

export function addQualityConsiderationsBlock(payload: ExportPayload, considerations: string[]): ExportPayload {
  const cleanedConsiderations = considerations.map((item) => item.trim()).filter(Boolean).slice(0, 6);
  if (!cleanedConsiderations.length) return payload;

  const withoutExisting = payload.blocks.filter((block) => block.id !== 'quality-considerations');
  const blocks = [
    ...withoutExisting,
    {
      id: 'quality-considerations',
      type: 'alert' as const,
      title: 'Consideraciones del analisis',
      data: cleanedConsiderations,
      priority: 18,
      visualHint: 'executive-warning',
      formats: ['pdf', 'excel', 'ppt'],
    },
  ];

  return {
    ...payload,
    blocks: cleanExportBlocks(blocks).filter((block) => isRenderable(block.data)),
  };
}
