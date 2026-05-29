import type { ExportPayload } from './types';
import { containsForbiddenExportTerm, isRenderable } from './isRenderable';

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function rowCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.rows)) return record.rows.length;
  }
  return value ? 1 : 0;
}

export function collectPayloadQualityIssues(payload: ExportPayload) {
  const criticalIssues: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  const detectedData: string[] = [];

  if (!text(payload.title)) criticalIssues.push('Titulo del entregable');
  if (!payload.blocks.some((block) => isRenderable(block.data))) criticalIssues.push('Al menos un bloque util para el usuario');

  payload.blocks.forEach((block) => {
    if (!isRenderable(block.data)) warnings.push(`El bloque "${block.title || block.id}" no contiene informacion util y sera omitido.`);
    if (containsForbiddenExportTerm(block.title) || containsForbiddenExportTerm(block.description) || containsForbiddenExportTerm(JSON.stringify(block.data))) {
      warnings.push('Se detecto informacion tecnica interna y sera omitida del archivo final.');
    }
  });

  const blockTypes = new Set(payload.blocks.map((block) => block.type));
  blockTypes.forEach((type) => detectedData.push(type));

  if (payload.agentId.includes('dashboard')) {
    if (!blockTypes.has('kpi')) criticalIssues.push('KPIs ejecutivos del dashboard');
    if (!blockTypes.has('chart') && !blockTypes.has('table') && !blockTypes.has('matrix')) {
      criticalIssues.push('Graficos o tablas utiles para interpretar datos');
    }
    if (!blockTypes.has('insight') && !blockTypes.has('recommendation')) {
      warnings.push('El dashboard no incluye suficientes hallazgos o recomendaciones accionables.');
    }
  }

  if (payload.agentId.includes('tco')) {
    const blocksById = new Map(payload.blocks.map((block) => [block.id, block]));
    const matrixRows = rowCount(blocksById.get('tco-matrix')?.data) || rowCount(blocksById.get('tco-financial-model')?.data);
    const rankingRows = rowCount(blocksById.get('tco-scorecard')?.data);
    const payloadText = JSON.stringify(payload).toLowerCase();
    if (!matrixRows) criticalIssues.push('Matriz de costos o modelo financiero TCO');
    if (!blockTypes.has('ranking') || rankingRows < 2) {
      criticalIssues.push('Ranking o comparacion clara de alternativas');
      criticalIssues.push('Al menos dos alternativas comparables para TCO');
    }
    if (!blockTypes.has('decision') && !blockTypes.has('recommendation')) warnings.push('Conviene reforzar la recomendacion estrategica.');
    if (!/(costo|coste|precio|inicial|adquisicion|adquisici[oÃ³]n|total|tco)/i.test(payloadText)) {
      criticalIssues.push('Costos directos o costo total identificable');
    }
    if (!/(horizonte|periodo|mensual|anual|a[nÃ±]o|meses|vigencia)/i.test(payloadText)) {
      warnings.push('Conviene validar el horizonte de analisis antes de decidir.');
    }
    if (!/(mantenimiento|operaci[oÃ³]n|operativo|soporte|implementaci[oÃ³]n|log[iÃ­]stica|transporte|indirecto|oculto)/i.test(payloadText)) {
      warnings.push('Conviene validar costos indirectos, mantenimiento o costos ocultos.');
    }
  }

  if (payload.agentId.includes('proposal')) {
    const blocksById = new Map(payload.blocks.map((block) => [block.id, block]));
    const rankingRows = rowCount(blocksById.get('proposal-ranking')?.data);
    const matrixRows = rowCount(blocksById.get('proposal-comparison-table')?.data) || rowCount(blocksById.get('proposal-evaluation-matrix')?.data);
    if (!blockTypes.has('summary')) criticalIssues.push('Resumen ejecutivo del comparativo');
    if (!blockTypes.has('ranking') || rankingRows < 2) criticalIssues.push('Ranking de al menos dos proveedores');
    if (!blockTypes.has('matrix') && !blockTypes.has('table')) criticalIssues.push('Matriz o tabla comparativa de criterios');
    if (!blockTypes.has('decision')) warnings.push('Conviene explicitar la decision o proveedor recomendado.');
    if (!matrixRows) criticalIssues.push('Matriz comparativa con criterios utiles');
    const payloadText = JSON.stringify(payload).toLowerCase();
    if (!/(precio|monto|total|importe|cotizacion|cotizaci[oó]n)/i.test(payloadText)) warnings.push('Conviene validar precios o montos antes de adjudicar.');
    if (!/(plazo|entrega|lead|tiempo|garant[ií]a|condiciones)/i.test(payloadText)) warnings.push('Faltan plazos, garantias o condiciones comerciales para cerrar la negociacion.');
  }

  if (payload.agentId.includes('terms')) {
    const ids = new Set(payload.blocks.map((block) => block.id));
    if (!blockTypes.has('summary')) criticalIssues.push('Resumen u objetivo del requerimiento');
    if (!ids.has('terms-document-deliverables') && !ids.has('terms-bases-requirements') && !ids.has('terms-invitation-email')) {
      warnings.push('Faltan entregables, requisitos o documento principal para completar el paquete.');
    }
  }

  payload.blocks
    .filter((block) => block.type === 'alert')
    .flatMap((block) => asArray(block.data))
    .map(text)
    .filter(Boolean)
    .forEach((item) => suggestions.push(item));

  return {
    criticalIssues: [...new Set(criticalIssues)].slice(0, 8),
    warnings: [...new Set(warnings)].slice(0, 8),
    suggestions: [...new Set(suggestions)].slice(0, 8),
    detectedData: [...new Set(detectedData)].slice(0, 8),
  };
}
