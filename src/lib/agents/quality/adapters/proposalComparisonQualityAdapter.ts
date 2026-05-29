import type { ExportPayload } from '@/lib/exports/types';
import type { QualityIssue, QualityValidationResult } from '../qualityTypes';
import { asArray, asRecord, hasAny, jsonText, rowCount } from '../qualityUtils';

function supplierCount(result: Record<string, unknown>, payload: ExportPayload) {
  const names = new Set<string>();
  asArray(result.suppliers).map(asRecord).forEach((supplier) => {
    if (supplier.supplier_name) names.add(String(supplier.supplier_name));
  });
  asArray(result.ranking).map(asRecord).forEach((item) => {
    if (item.supplier_name) names.add(String(item.supplier_name));
  });
  payload.blocks.forEach((block) => {
    if (block.type === 'ranking' || block.type === 'matrix' || block.type === 'table') {
      const matches = jsonText(block.data).match(/proveedor\s+[a-z0-9]+/gi) ?? [];
      matches.forEach((item) => names.add(item));
    }
  });
  return names.size;
}

export function validateProposalComparisonMinimumData(result: unknown, payload: ExportPayload): QualityValidationResult {
  const data = asRecord(result);
  const issues: QualityIssue[] = [];
  const text = `${jsonText(result)} ${jsonText(payload)}`;
  const suppliers = supplierCount(data, payload);

  if (suppliers === 0) {
    issues.push({
      code: 'proposal-no-suppliers',
      message: 'No se detectaron proveedores o propuestas comparables.',
      severity: 'blocking',
      field: 'suppliers',
      stage: 'Extrayendo datos de proveedores',
      userCanOverride: false,
    });
  } else if (suppliers < 2) {
    issues.push({
      code: 'proposal-one-supplier',
      message: 'Solo se detecto un proveedor; no se debe crear un ranking comparativo falso.',
      severity: 'recoverable',
      field: 'suppliers',
      stage: 'Generando ranking de proveedores',
      suggestion: 'Agrega al menos una propuesta adicional o continua con un analisis individual limitado.',
      userCanOverride: true,
    });
  }

  if (!hasAny(text, [/precio|monto|importe|total|cotizaci[oó]n|tarifa|fee|s\/|\$|usd|pen/i])) {
    issues.push({
      code: 'proposal-missing-prices',
      message: 'No se detectaron precios o condiciones comerciales suficientes.',
      severity: suppliers ? 'recoverable' : 'blocking',
      field: 'commercial_terms',
      stage: 'Comparando precios, plazos y condiciones',
      suggestion: 'Agrega montos, moneda, forma de pago, vigencia o condiciones comerciales.',
      userCanOverride: suppliers > 0,
    });
  }

  if (!hasAny(text, [/plazo|entrega|vigencia|garant[ií]a|lead time|condiciones/i])) {
    issues.push({
      code: 'proposal-missing-deadlines',
      message: 'Faltan plazos, vigencias, garantias o condiciones de entrega.',
      severity: 'warning',
      field: 'deadlines',
      stage: 'Comparando precios, plazos y condiciones',
    });
  }

  if (rowCount(data.comparison_table) === 0 && rowCount(asRecord(data.evaluation_matrix).criteria) === 0) {
    issues.push({
      code: 'proposal-missing-criteria',
      message: 'No se detectaron criterios de evaluacion comparables.',
      severity: 'recoverable',
      field: 'criteria',
      stage: 'Aplicando reglas de evaluacion',
      suggestion: 'Define criterios de evaluacion o pesos antes de descargar el comparativo.',
      userCanOverride: true,
    });
  }

  if (!hasAny(text, [/alcance|incluye|excluye|servicio|entregable|riesgo|diferencia/i])) {
    issues.push({
      code: 'proposal-missing-scope-risk',
      message: 'Conviene validar alcance, exclusiones, riesgos o diferencias relevantes.',
      severity: 'warning',
      field: 'scope',
      stage: 'Evaluando cumplimiento tecnico y comercial',
    });
  }

  return { issues };
}
