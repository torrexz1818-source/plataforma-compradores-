import type { ExportPayload } from './types';
import { containsForbiddenExportTerm, isRenderable } from './isRenderable';

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return String(value ?? '').trim();
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
    const blockIds = new Set(payload.blocks.map((block) => block.id));
    if (!blockIds.has('tco-matrix') && !blockIds.has('tco-financial-model')) criticalIssues.push('Matriz de costos o modelo financiero TCO');
    if (!blockTypes.has('ranking')) criticalIssues.push('Ranking o comparacion clara de alternativas');
    if (!blockTypes.has('decision') && !blockTypes.has('recommendation')) warnings.push('Conviene reforzar la recomendacion estrategica.');
  }

  if (payload.agentId.includes('proposal')) {
    if (!blockTypes.has('summary')) criticalIssues.push('Resumen ejecutivo del comparativo');
    if (!blockTypes.has('ranking')) criticalIssues.push('Ranking de proveedores');
    if (!blockTypes.has('matrix') && !blockTypes.has('table')) criticalIssues.push('Matriz o tabla comparativa de criterios');
    if (!blockTypes.has('decision')) warnings.push('Conviene explicitar la decision o proveedor recomendado.');
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
