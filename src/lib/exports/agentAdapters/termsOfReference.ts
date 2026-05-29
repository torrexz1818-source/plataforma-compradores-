import type { ExportBuildOptions, ExportPayload } from '../types';
import { asArray, asRecord, block, firstRenderable, keyValueTable, listTable, tableFromRows, text } from './utils';

function includesScope(options: ExportBuildOptions | undefined, section: string) {
  const sections = options?.termsScope?.sections;
  return !sections?.length || sections.includes(section);
}

export function termsOfReferenceToExportPayload(result: unknown, options?: ExportBuildOptions): ExportPayload {
  const data = asRecord(result);
  const document = asRecord(data.generated_document);
  const title = options?.termsScope?.documentTitle
    ? `${options.termsScope.documentCode} ${options.termsScope.documentTitle}`
    : text(data.title, 'Terminos de referencia');
  const blocks = [
    block('terms-summary', 'summary', 'Resumen ejecutivo', firstRenderable(data.executive_summary, document.objective), 10),
    block('terms-kpis', 'kpi', 'Metricas del requerimiento', data.dashboard_metrics, 20, undefined, 'kpi-cards'),
  ];

  if (includesScope(options, 'tdr')) {
    blocks.push(
      block('terms-document-general', 'table', 'Datos generales', keyValueTable(asRecord(document.general_data)), 30),
      block('terms-document-objective', 'summary', 'Objetivo y alcance', { objetivo: document.objective, alcance: document.scope, justificacion: document.justification }, 35),
      block('terms-document-deliverables', 'table', 'Entregables', listTable(asArray(document.final_deliverables), 'Entregable'), 40),
      block('terms-document-technical', 'table', 'Caracteristicas y actividades', {
        title: 'Caracteristicas y actividades',
        columns: ['Tipo', 'Detalle'],
        rows: [
          ...asArray(document.technical_characteristics).map((item) => ({ Tipo: 'Caracteristica', Detalle: item })),
          ...asArray(document.required_activities).map((item) => ({ Tipo: 'Actividad', Detalle: item })),
        ],
      }, 45),
    );
  }

  if (includesScope(options, 'matrizRiesgos')) {
    blocks.push(
      block('terms-evaluation-matrix', 'matrix', 'Matriz de evaluacion', firstRenderable(document.evaluation_matrix, document.evaluation_criteria), 50),
      block('terms-compliance-matrix', 'matrix', 'Matriz de cumplimiento', document.compliance_matrix, 55),
      block('terms-risks', 'risk', 'Riesgos identificados', document.identified_risks, 60),
    );
  }

  if (includesScope(options, 'calidad')) {
    blocks.push(
      block('terms-checklist', 'table', 'Checklist de calidad', tableFromRows(asArray(data.checklist)), 65),
      block('terms-quality', 'alert', 'Control de calidad', firstRenderable(data.quality_check, data.consistency_validation), 70),
    );
  }

  if (includesScope(options, 'bases')) {
    const bases = asRecord(data.tender_bases);
    blocks.push(
      block('terms-bases-summary', 'summary', 'Bases del concurso', { objeto: bases.object, alcance: bases.scope, disclaimer: bases.disclaimer }, 30),
      block('terms-bases-requirements', 'table', 'Requisitos y documentacion', {
        title: 'Requisitos y documentacion',
        columns: ['Tipo', 'Detalle'],
        rows: [
          ...asArray(bases.minimum_supplier_requirements).map((item) => ({ Tipo: 'Requisito minimo', Detalle: item })),
          ...asArray(bases.requested_documentation).map((item) => ({ Tipo: 'Documento solicitado', Detalle: item })),
          ...asArray(bases.evaluation_criteria).map((item) => ({ Tipo: 'Criterio de evaluacion', Detalle: item })),
        ],
      }, 40),
      block('terms-bases-conditions', 'table', 'Condiciones del concurso', keyValueTable({
        question_deadline: bases.question_deadline,
        proposal_deadline: bases.proposal_deadline,
        submission_method: bases.submission_method,
      }), 50),
    );
  }

  if (includesScope(options, 'invitacion')) {
    const email = asRecord(data.supplier_invitation_email);
    blocks.push(
      block('terms-invitation-email', 'summary', 'Invitacion a postores', email, 30, undefined, 'email-summary'),
      block('terms-invitation-bidders', 'table', 'Postores invitados', tableFromRows(asArray(data.invited_bidders)), 40),
    );
  }

  if (includesScope(options, 'cronograma')) {
    blocks.push(block('terms-schedule', 'timeline', 'Cronograma del proceso', tableFromRows(asArray(data.process_schedule)), 30));
  }

  if (includesScope(options, 'pendientes') || includesScope(options, 'recomendaciones')) {
    blocks.push(
      block('terms-missing-information', 'alert', 'Informacion por completar', firstRenderable(data.missing_information, data.recommended_questions), 80),
      block('terms-buyer-recommendations', 'recommendation', 'Recomendaciones para comprador', data.buyer_recommendations, 90),
    );
  }

  return {
    agentId: 'terms_of_reference',
    title,
    subtitle: [text(data.requirement_type), text(data.category), text(data.risk_level)].filter(Boolean).join(' | '),
    blocks,
  };
}
