import type { ExportPayload } from '@/lib/exports/types';
import type { QualityIssue, QualityValidationResult } from '../qualityTypes';
import { asArray, asRecord, hasAny, jsonText, rowCount } from '../qualityUtils';

const costPatterns = [/costo|coste|precio|monto|importe|tco|total|adquisici[oó]n|inicial|tarifa|fee/i];
const operatingCostPatterns = [/operaci[oó]n|operativo|mantenimiento|implementaci[oó]n|soporte|log[ií]stica|transporte|riesgo|residual|seguro/i];

function alternativeCount(data: Record<string, unknown>, payload: ExportPayload) {
  const names = new Set<string>();
  asArray(data.detected_alternatives).map(asRecord).forEach((item) => {
    if (item.supplier_name) names.add(String(item.supplier_name));
  });
  asArray(data.ranking).map(asRecord).forEach((item) => {
    if (item.alternative) names.add(String(item.alternative));
  });
  asArray(data.financial_model).map(asRecord).forEach((item) => {
    if (item.alternative || item.Alternativa) names.add(String(item.alternative ?? item.Alternativa));
  });
  asArray(asRecord(data.scorecard).totals).map(asRecord).forEach((item) => {
    if (item.alternative) names.add(String(item.alternative));
  });
  asArray(data.tco_matrix).map(asRecord).forEach((row) => {
    Object.keys(asRecord(row.values)).forEach((name) => names.add(name));
  });
  payload.blocks.forEach((block) => {
    if (block.type === 'ranking' || block.type === 'matrix' || block.type === 'table') {
      const text = jsonText(block.data);
      const matches = text.match(/alternativa\s+[a-z0-9]+|proveedor\s+[a-z0-9]+/gi) ?? [];
      matches.forEach((item) => names.add(item));
    }
  });
  return names.size;
}

export function validateTcoMinimumData(result: unknown, payload: ExportPayload): QualityValidationResult {
  const data = asRecord(result);
  const issues: QualityIssue[] = [];
  const text = `${jsonText(result)} ${jsonText(payload)}`;
  const alternatives = alternativeCount(data, payload);
  const hasCostEvidence = hasAny(text, costPatterns) && (
    rowCount(data.tco_matrix) > 0 ||
    rowCount(data.financial_model) > 0 ||
    rowCount(data.tco_totals) > 0 ||
    hasAny(text, [/s\/|\$|usd|pen|eur|\d+[,.]?\d*/i])
  );

  if (alternatives === 0) {
    issues.push({
      code: 'tco-no-alternatives',
      message: 'No se detectaron alternativas, soluciones o proveedores para comparar en el TCO.',
      severity: 'blocking',
      field: 'alternatives',
      stage: 'Matriz TCO',
      userCanOverride: false,
    });
  } else if (alternatives < 2) {
    issues.push({
      code: 'tco-one-alternative',
      message: 'Solo se detecto una alternativa; no se debe crear un ranking TCO falso.',
      severity: 'recoverable',
      field: 'alternatives',
      stage: 'Scorecard y ranking',
      suggestion: 'Agrega otra alternativa o continua con un analisis limitado sin ranking comparativo.',
      userCanOverride: true,
    });
  }

  if (!hasCostEvidence) {
    issues.push({
      code: 'tco-no-costs',
      message: 'No se detectaron costos o precios suficientes para construir calculos TCO confiables.',
      severity: alternatives ? 'recoverable' : 'blocking',
      field: 'costs',
      stage: 'Modelo financiero',
      suggestion: 'Agrega precios, costos iniciales, costos operativos, mantenimiento o condiciones comerciales.',
      userCanOverride: alternatives > 0,
    });
  }

  if (!/horizonte|periodo|a[nñ]o|mes|vida util|vigencia/i.test(text)) {
    issues.push({
      code: 'tco-missing-horizon',
      message: 'No se identifico claramente el horizonte de analisis.',
      severity: 'recoverable',
      field: 'evaluation_horizon',
      stage: 'Modelo financiero',
      suggestion: 'Indica el periodo de evaluacion para evitar conclusiones incompletas.',
      userCanOverride: true,
    });
  }

  if (!hasAny(text, operatingCostPatterns)) {
    issues.push({
      code: 'tco-missing-indirect-costs',
      message: 'Faltan costos operativos, mantenimiento, implementacion o riesgos para un TCO completo.',
      severity: 'warning',
      field: 'operating_costs',
      stage: 'Modelo financiero',
      suggestion: 'Completa costos indirectos para mejorar la precision.',
      userCanOverride: true,
    });
  }

  if (!/supuesto|limitaci[oó]n|riesgo|condici[oó]n/i.test(text)) {
    issues.push({
      code: 'tco-missing-assumptions',
      message: 'Conviene explicitar supuestos, riesgos y condiciones relevantes del TCO.',
      severity: 'warning',
      field: 'assumptions',
      stage: 'Organizando datos',
    });
  }

  return { issues };
}
