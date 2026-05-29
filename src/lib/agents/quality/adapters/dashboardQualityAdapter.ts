import type { ExportPayload } from '@/lib/exports/types';
import type { QualityIssue, QualityValidationResult } from '../qualityTypes';
import { asArray, asRecord, hasAny, jsonText } from '../qualityUtils';

function tableStats(result: Record<string, unknown>, payload: ExportPayload) {
  const profile = asRecord(result.data_profile ?? result.dataProfile);
  const rowsDetected = Number(profile.rows_detected ?? 0);
  const columnsDetected = Number(profile.columns_detected ?? 0);
  const tableRows = asArray(result.tables)
    .map(asRecord)
    .reduce((total, table) => total + asArray(table.rows).length, 0);
  const payloadRows = payload.blocks
    .filter((block) => block.type === 'table' || block.type === 'matrix')
    .reduce((total, block) => total + asArray(block.data).map(asRecord).reduce((sum, table) => sum + asArray(table.rows).length, 0), 0);
  return {
    rows: Math.max(rowsDetected, tableRows, payloadRows),
    columns: Math.max(columnsDetected, asArray(profile.detected_columns).length),
  };
}

export function validateDashboardMinimumData(result: unknown, payload: ExportPayload): QualityValidationResult {
  const data = asRecord(result);
  const issues: QualityIssue[] = [];
  const text = `${jsonText(result)} ${jsonText(payload)}`;
  const stats = tableStats(data, payload);
  const kpis = asArray(data.kpis).length;
  const charts = asArray(data.charts).filter((chart) => asArray(asRecord(chart).data).length).length;
  const tables = asArray(data.tables).filter((table) => asArray(asRecord(table).rows).length).length;

  if (stats.rows === 0 && !tables && !charts) {
    issues.push({
      code: 'dashboard-no-tabular-data',
      message: 'No se detectaron datos tabulares suficientes para construir un dashboard.',
      severity: 'blocking',
      field: 'data',
      stage: 'Detectando hojas y columnas',
      userCanOverride: false,
    });
  }

  if (stats.columns > 0 && stats.columns < 2) {
    issues.push({
      code: 'dashboard-too-few-columns',
      message: 'El archivo tiene muy pocas columnas utiles para crear KPIs o visualizaciones.',
      severity: 'recoverable',
      field: 'columns',
      stage: 'Detectando hojas y columnas',
      suggestion: 'Agrega columnas de proveedor, categoria, fecha, monto, estado u otra dimension analitica.',
      userCanOverride: true,
    });
  }

  if (!kpis) {
    issues.push({
      code: 'dashboard-no-kpis',
      message: 'No se generaron KPIs con valores reales.',
      severity: 'recoverable',
      field: 'kpis',
      stage: 'Calculando KPIs',
      suggestion: 'Agrega campos numericos o confirma un dashboard narrativo limitado.',
      userCanOverride: true,
    });
  }

  if (!charts && !tables) {
    issues.push({
      code: 'dashboard-no-visuals',
      message: 'No hay graficos o tablas con datos reales para mostrar.',
      severity: 'recoverable',
      field: 'charts',
      stage: 'Generando graficos',
      suggestion: 'Agrega datos tabulares o continua con un reporte limitado sin graficos vacios.',
      userCanOverride: true,
    });
  }

  if (!hasAny(text, [/proveedor|categoria|monto|fecha|compra|gasto|contrato|inventario|indicador|kpi/i])) {
    issues.push({
      code: 'dashboard-weak-business-data',
      message: 'Los datos detectados no muestran dimensiones claras para un dashboard de compras.',
      severity: 'recoverable',
      field: 'business_dimensions',
      stage: 'Aplicando instrucciones',
      suggestion: 'Agrega contexto o columnas que expliquen proveedor, categoria, monto, fecha o estado.',
      userCanOverride: true,
    });
  }

  return { issues };
}
