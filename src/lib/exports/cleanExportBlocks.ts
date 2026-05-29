import type { ExportBlock, ExportFormat } from './types';
import { isRenderable } from './isRenderable';
import { sanitizeExportContent } from './sanitizeExportContent';

export function cleanExportBlocks(blocks: ExportBlock[], format?: ExportFormat) {
  return blocks
    .filter((block) => !format || !block.formats || block.formats.includes(format))
    .map((block) => ({
      ...block,
      title: sanitizeExportContent(block.title).value as string | undefined,
      description: sanitizeExportContent(block.description).value as string | undefined,
      data: sanitizeExportContent(block.data).value,
    }))
    .filter((block) => isRenderable(block.data))
    .sort((a, b) => a.priority - b.priority);
}
