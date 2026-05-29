import type { ExportPayload } from '@/lib/exports/types';
import { isRenderable } from '@/lib/exports/isRenderable';
import type { AgentQualityKey, QualityIssue, QualityValidationResult } from './qualityTypes';
import { countMatches, hasAny, jsonText } from './qualityUtils';

const relevanceTerms: Record<string, RegExp[]> = {
  tco_analysis: [
    /costo|coste|precio|tco|total|mantenimiento|operaci[oó]n|implementaci[oó]n|proveedor|alternativa|cotizaci[oó]n|financier/i,
    /garant[ií]a|plazo|riesgo|incoterm|log[ií]stica|soporte|horizonte|vida util/i,
  ],
  proposal_comparison: [
    /proveedor|propuesta|cotizaci[oó]n|precio|monto|plazo|garant[ií]a|alcance|condiciones|criterio/i,
    /ranking|evaluaci[oó]n|comparativo|adjudicaci[oó]n|riesgo|certificaci[oó]n|servicio/i,
  ],
  terms_of_reference: [
    /objetivo|alcance|requisito|entregable|criterio|cronograma|condici[oó]n|responsable|tdr|terminos/i,
    /bases|concurso|proveedor|servicio|producto|actividad|evaluaci[oó]n|contrataci[oó]n/i,
  ],
  dashboard_creator: [
    /dashboard|kpi|indicador|tabla|columna|fila|grafico|gr[aá]fico|monto|proveedor|categoria|compra/i,
    /gasto|ahorro|contrato|inventario|fecha|periodo|visualizaci[oó]n|ranking|dato/i,
  ],
};

function normalizedAgent(agentKey?: AgentQualityKey) {
  const raw = String(agentKey || 'generic');
  if (raw.includes('tco')) return 'tco_analysis';
  if (raw.includes('proposal') || raw.includes('quote')) return 'proposal_comparison';
  if (raw.includes('terms')) return 'terms_of_reference';
  if (raw.includes('dashboard')) return 'dashboard_creator';
  return raw;
}

export function validateRelevance(input: {
  agentKey?: AgentQualityKey;
  result: unknown;
  payload: ExportPayload;
  userInstructions?: string;
}): QualityValidationResult {
  const issues: QualityIssue[] = [];
  const agentKey = normalizedAgent(input.agentKey);
  const payloadText = jsonText(input.payload);
  const sourceText = `${payloadText} ${jsonText(input.result)} ${jsonText(input.userInstructions)}`;
  const renderableBlocks = input.payload.blocks.filter((block) => isRenderable(block.data));

  if (!renderableBlocks.length || payloadText.length < 60) {
    issues.push({
      code: 'relevance-no-usable-content',
      message: 'No se encontro contenido util para construir un entregable profesional.',
      severity: 'blocking',
      stage: 'Extrayendo datos',
      userCanOverride: false,
    });
    return { issues };
  }

  const terms = relevanceTerms[agentKey];
  if (!terms?.length) return { issues };

  const hits = countMatches(sourceText, terms);
  if (!hasAny(sourceText, terms)) {
    issues.push({
      code: 'relevance-agent-mismatch',
      message: 'El contenido cargado parece poco relacionado con el tipo de agente seleccionado.',
      severity: 'blocking',
      stage: 'Detectando tipo',
      suggestion: 'Cambia el documento o agrega informacion minima relacionada con el agente.',
      userCanOverride: false,
    });
  } else if (hits < Math.min(2, terms.length)) {
    issues.push({
      code: 'relevance-weak-match',
      message: 'La relacion entre el documento y el objetivo del agente es debil.',
      severity: 'recoverable',
      stage: 'Detectando tipo',
      suggestion: 'Agrega instrucciones o documentos con datos mas especificos antes de descargar.',
      userCanOverride: true,
    });
  }

  return { issues };
}
