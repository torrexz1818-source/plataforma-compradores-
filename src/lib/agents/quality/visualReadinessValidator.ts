import type { ExportPayload } from '@/lib/exports/types';
import { isPlaceholderText, isRenderable } from '@/lib/exports/isRenderable';
import type { QualityIssue, QualityValidationResult } from './qualityTypes';
import { asArray, asRecord, tableShape } from './qualityUtils';

function hasChartData(chart: Record<string, unknown>) {
  return asArray(chart.data).map(asRecord).some((point) => isRenderable(point.label) && isRenderable(point.value));
}

function placeholderCount(value: unknown) {
  const text = JSON.stringify(value ?? '').toLowerCase();
  return (text.match(/dato faltante|n\/a|sin informaci[oó]n|no disponible|pendiente|undefined|null|no especificado/g) ?? []).length;
}

export function validateVisualReadiness(payload: ExportPayload): QualityValidationResult {
  const issues: QualityIssue[] = [];
  const renderableBlocks = payload.blocks.filter((block) => isRenderable(block.data));

  if (!renderableBlocks.length) {
    issues.push({
      code: 'visual-no-renderable-blocks',
      message: 'El entregable no contiene secciones utiles para exportar.',
      severity: 'blocking',
      stage: 'Descargables',
      userCanOverride: false,
    });
  }

  payload.blocks.forEach((block) => {
    if (!isRenderable(block.data)) {
      issues.push({
        code: `visual-empty-${block.id}`,
        message: `La seccion "${block.title || block.id}" no contiene informacion util y sera omitida.`,
        severity: 'warning',
        stage: 'Descargables',
      });
      return;
    }

    if (block.type === 'table' || block.type === 'matrix' || block.type === 'timeline') {
      const tables = Array.isArray(block.data) ? asArray(block.data).map(asRecord) : [asRecord(block.data)];
      tables.forEach((table) => {
        if (!Array.isArray(table.columns) || !Array.isArray(table.rows)) return;
        const shape = tableShape(table);
        if (!shape.columns.length || !shape.rows.length) {
          issues.push({
            code: `visual-empty-table-${block.id}`,
            message: `La tabla "${table.title || block.title || block.id}" no tiene filas o columnas utiles.`,
            severity: 'warning',
            stage: 'Descargables',
          });
        }
      });
    }

    if (block.type === 'chart') {
      const charts = asArray(block.data).map(asRecord);
      if (!charts.some(hasChartData)) {
        issues.push({
          code: `visual-empty-chart-${block.id}`,
          message: 'No se generaran graficos sin datos reales.',
          severity: 'recoverable',
          stage: 'Descargables',
          suggestion: 'Agrega datos tabulares con valores numericos o continua con tablas y resumen ejecutivo.',
          userCanOverride: true,
        });
      }
    }

    if (block.type === 'kpi') {
      const kpis = asArray(block.data).map(asRecord);
      if (!kpis.some((kpi) => isRenderable(kpi.value) && !isPlaceholderText(kpi.value))) {
        issues.push({
          code: `visual-empty-kpi-${block.id}`,
          message: 'Los KPIs no tienen valores reales suficientes.',
          severity: 'recoverable',
          stage: 'Descargables',
          suggestion: 'Agrega datos cuantitativos o genera un entregable narrativo limitado.',
          userCanOverride: true,
        });
      }
    }
  });

  const placeholders = placeholderCount(payload);
  if (placeholders >= 12) {
    issues.push({
      code: 'visual-too-many-placeholders',
      message: 'Se detectaron muchos campos sin informacion; se agruparan como consideraciones en lugar de llenar tablas con placeholders.',
      severity: 'recoverable',
      stage: 'Descargables',
      suggestion: 'Completa precios, plazos, responsables, criterios o condiciones antes de exportar.',
      userCanOverride: true,
    });
  } else if (placeholders >= 4) {
    issues.push({
      code: 'visual-placeholder-warning',
      message: 'Hay varios campos incompletos; se limpiaran del entregable y se resumiran como advertencias.',
      severity: 'warning',
      stage: 'Descargables',
    });
  }

  return { issues };
}
