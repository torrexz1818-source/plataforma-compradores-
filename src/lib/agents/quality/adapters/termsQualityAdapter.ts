import type { ExportPayload } from '@/lib/exports/types';
import type { QualityIssue, QualityValidationResult } from '../qualityTypes';
import { asArray, asRecord, hasAny, jsonText } from '../qualityUtils';

export function validateTermsMinimumData(result: unknown, payload: ExportPayload): QualityValidationResult {
  const data = asRecord(result);
  const document = asRecord(data.generated_document);
  const issues: QualityIssue[] = [];
  const text = `${jsonText(result)} ${jsonText(payload)}`;
  const hasCore = Boolean(document.objective || document.scope || data.executive_summary || data.title);

  if (!hasCore) {
    issues.push({
      code: 'terms-no-core-document',
      message: 'No se detecto objeto, objetivo o alcance minimo para construir el documento.',
      severity: 'blocking',
      field: 'objective',
      stage: 'Organizando requerimiento',
      userCanOverride: false,
    });
  }

  [
    ['terms-missing-objective', 'Objeto u objetivo del requerimiento', document.objective],
    ['terms-missing-scope', 'Alcance del requerimiento', document.scope],
    ['terms-missing-deliverables', 'Entregables esperados', asArray(document.final_deliverables).length],
  ].forEach(([code, label, value]) => {
    if (!value) {
      issues.push({
        code: String(code),
        message: `Falta ${String(label).toLowerCase()} para cerrar el termino de referencia.`,
        severity: hasCore ? 'recoverable' : 'blocking',
        field: String(label),
        stage: 'Generando TDR',
        suggestion: 'Completa el formulario con el dato minimo antes de descargar el documento final.',
        userCanOverride: hasCore,
      });
    }
  });

  if (!hasAny(text, [/requisito|especificaci[oó]n|actividad|condici[oó]n|responsable/i])) {
    issues.push({
      code: 'terms-missing-requirements',
      message: 'Faltan requisitos, condiciones o responsables suficientes.',
      severity: 'recoverable',
      field: 'requirements',
      stage: 'Construyendo matrices y criterios',
      suggestion: 'Agrega requisitos tecnicos, condiciones o responsables del proceso.',
      userCanOverride: true,
    });
  }

  if (!hasAny(text, [/criterio|evaluaci[oó]n|puntaje|matriz|cumplimiento/i])) {
    issues.push({
      code: 'terms-missing-evaluation',
      message: 'Faltan criterios de evaluacion o matriz de cumplimiento.',
      severity: 'recoverable',
      field: 'evaluation_criteria',
      stage: 'Construyendo matrices y criterios',
      suggestion: 'Agrega criterios de evaluacion antes de enviar el documento a proveedores.',
      userCanOverride: true,
    });
  }

  if (!hasAny(text, [/cronograma|fecha|plazo|inicio|fin|duraci[oó]n/i])) {
    issues.push({
      code: 'terms-missing-schedule',
      message: 'Conviene completar cronograma o plazos del proceso.',
      severity: 'warning',
      field: 'schedule',
      stage: 'Construyendo cronograma',
    });
  }

  return { issues };
}
