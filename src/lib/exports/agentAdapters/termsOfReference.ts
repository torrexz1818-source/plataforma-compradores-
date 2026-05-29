import type { ExportBuildOptions, ExportPayload } from '../types';
import { isRenderable } from '../isRenderable';
import { asArray, asRecord, block, firstRenderable, keyValueTable, listTable, tableFromRows, text } from './utils';

const pendingTokenPattern = /\[(COMPLETAR|SUGERIDO)[^\]]*\]/gi;

function includesScope(options: ExportBuildOptions | undefined, section: string) {
  const sections = options?.termsScope?.sections;
  return !sections?.length || sections.includes(section);
}

function cleanTermsValue(value: unknown): unknown {
  if (typeof value === 'string') {
    const cleaned = text(value)
      .replace(pendingTokenPattern, '')
      .replace(/\{[^}]+\}/g, '')
      .replace(/[{}]/g, '')
      .replace(/\s+\|/g, ' |')
      .replace(/\|\s+\|/g, '|')
      .trim();
    return isRenderable(cleaned) ? cleaned : undefined;
  }
  if (Array.isArray(value)) {
    const cleaned = value.map(cleanTermsValue).filter(isRenderable);
    return cleaned.length ? cleaned : undefined;
  }
  if (value && typeof value === 'object') {
    const cleaned = Object.entries(asRecord(value)).reduce<Record<string, unknown>>((acc, [key, item]) => {
      const nextValue = cleanTermsValue(item);
      if (isRenderable(nextValue)) acc[key] = nextValue;
      return acc;
    }, {});
    return isRenderable(cleaned) ? cleaned : undefined;
  }
  return isRenderable(value) ? value : undefined;
}

function cleanText(value: unknown) {
  const cleaned = cleanTermsValue(value);
  return typeof cleaned === 'string' ? cleaned : text(cleaned);
}

function joinClean(values: unknown[], separator = ' | ') {
  return values.map(cleanText).filter(Boolean).join(separator);
}

function compactRows<T extends Record<string, unknown>>(rows: T[]) {
  return rows
    .map((row) => Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
      const nextValue = cleanTermsValue(value);
      if (isRenderable(nextValue)) acc[key] = nextValue;
      return acc;
    }, {}))
    .filter(isRenderable);
}

function cleanTableFromRows(rows: Array<Record<string, unknown>>, title?: string) {
  return tableFromRows(compactRows(rows), title);
}

function cleanKeyValueTable(record: Record<string, unknown>, title?: string) {
  const cleaned = cleanTermsValue(record);
  return keyValueTable(asRecord(cleaned), title);
}

function cleanListTable(values: unknown[], valueLabel = 'Detalle', title?: string) {
  return listTable(asArray(cleanTermsValue(values)), valueLabel, title);
}

function pendingRowsFrom(result: Record<string, unknown>) {
  const pending = [
    ...asArray(result.missing_information).map((item) => ({
      Tipo: 'Pendiente',
      Detalle: item,
      Prioridad: 'Alta',
      Accion: 'Completar o validar antes de enviar el documento.',
    })),
    ...asArray(result.recommended_questions).map((item) => ({
      Tipo: 'Pregunta de validacion',
      Detalle: item,
      Prioridad: 'Media',
      Accion: 'Resolver con el usuario interno o proveedor antes del envio final.',
    })),
    ...asArray(result.buyer_recommendations).map((item) => ({
      Tipo: 'Recomendacion',
      Detalle: item,
      Prioridad: 'Media',
      Accion: 'Evaluar antes de publicar o enviar el paquete.',
    })),
  ];
  return compactRows(pending);
}

export function termsOfReferenceToExportPayload(result: unknown, options?: ExportBuildOptions): ExportPayload {
  const data = asRecord(result);
  const document = asRecord(data.generated_document);
  const bases = asRecord(data.tender_bases);
  const email = asRecord(data.supplier_invitation_email);
  const pendingRows = pendingRowsFrom(data);
  const title = options?.termsScope?.documentTitle
    ? `${options.termsScope.documentCode} ${options.termsScope.documentTitle}`
    : text(data.title, 'Terminos de referencia');
  const blocks = [
    block('terms-summary', 'summary', 'Resumen ejecutivo', cleanTermsValue(firstRenderable(data.executive_summary, document.objective)), 10),
    block('terms-kpis', 'kpi', 'Metricas del requerimiento', cleanTermsValue(data.dashboard_metrics), 20, undefined, 'kpi-cards'),
  ];

  if (options?.termsScope?.hasPendingWarnings) {
    blocks.push(block(
      'terms-pending-warning',
      'alert',
      'Advertencia de datos pendientes',
      'El documento se genero con informacion parcial. Revisa los campos pendientes antes de enviarlo formalmente.',
      12,
    ));
  }

  if (includesScope(options, 'tdr')) {
    blocks.push(
      block('terms-document-general', 'table', 'Resumen TDR', cleanKeyValueTable({
        ...asRecord(document.general_data),
        codigo_proceso: options?.termsScope?.processCode || data.process_code,
        entidad_convocante: data.contracting_entity,
      }), 30),
      block('terms-document-complete', 'table', 'TDR completo', {
        title: 'TDR completo',
        columns: ['Seccion', 'Subseccion', 'Contenido'],
        rows: compactRows([
          { Seccion: 'Antecedentes', Subseccion: 'Justificacion', Contenido: document.background || document.justification },
          { Seccion: 'Objetivo', Subseccion: 'Contratacion', Contenido: document.objective },
          { Seccion: 'Alcance', Subseccion: 'Servicio, producto o proyecto', Contenido: document.scope },
          ...asArray(document.technical_characteristics).map((item) => ({ Seccion: 'Especificaciones tecnicas', Subseccion: 'Caracteristica', Contenido: item })),
          ...asArray(document.required_activities).map((item) => ({ Seccion: 'Actividades requeridas', Subseccion: 'Actividad', Contenido: item })),
          ...asArray(document.final_deliverables).map((item) => ({ Seccion: 'Entregables esperados', Subseccion: 'Entregable', Contenido: item })),
          ...asArray(document.required_documents).map((item) => ({ Seccion: 'Documentos requeridos', Subseccion: 'Proveedor', Contenido: item })),
          ...asArray(document.applicable_standards).map((item) => ({ Seccion: 'Normas o marco aplicable', Subseccion: 'Referencia', Contenido: item })),
          ...asArray(document.execution_conditions).map((item) => ({ Seccion: 'Condiciones de ejecucion', Subseccion: 'Metodologia', Contenido: item })),
          ...asArray(document.supplier_conditions).map((item) => ({ Seccion: 'Requisitos del proveedor', Subseccion: 'Condicion', Contenido: item })),
          ...asArray(document.commercial_conditions).map((item) => ({ Seccion: 'Condiciones comerciales', Subseccion: 'Condicion', Contenido: item })),
        ]),
      }, 35),
      block('terms-document-deliverables', 'table', 'Entregables', cleanListTable(asArray(document.final_deliverables), 'Entregable'), 40),
      block('terms-document-technical', 'table', 'Especificaciones y entregables', {
        title: 'Especificaciones y entregables',
        columns: ['Tipo', 'Detalle'],
        rows: compactRows([
          ...asArray(document.technical_characteristics).map((item) => ({ Tipo: 'Caracteristica', Detalle: item })),
          ...asArray(document.required_activities).map((item) => ({ Tipo: 'Actividad', Detalle: item })),
          ...asArray(document.final_deliverables).map((item) => ({ Tipo: 'Entregable', Detalle: item })),
        ]),
      }, 45),
    );
  }

  if (includesScope(options, 'matrizRiesgos')) {
    blocks.push(
      block('terms-evaluation-matrix', 'matrix', 'Matriz de evaluacion', cleanTermsValue(firstRenderable(document.evaluation_matrix, document.evaluation_criteria)), 50),
      block('terms-compliance-matrix', 'matrix', 'Matriz de cumplimiento', cleanTermsValue(document.compliance_matrix), 55),
      block('terms-guarantees-penalties', 'table', 'Garantias y penalidades', cleanTableFromRows(asArray(document.guarantees_penalties).map(asRecord)), 57),
      block('terms-risks', 'risk', 'Riesgos identificados', cleanTermsValue(document.identified_risks), 60),
    );
  }

  if (includesScope(options, 'calidad')) {
    blocks.push(
      block('terms-checklist', 'table', 'Checklist de calidad', cleanTableFromRows(asArray(data.checklist).map(asRecord)), 65),
      block('terms-quality', 'alert', 'Control de calidad', cleanTermsValue(firstRenderable(data.quality_check, data.consistency_validation)), 70),
      block('terms-tdr-recommendations', 'recommendation', 'Recomendaciones TDR', cleanTermsValue(data.buyer_recommendations), 75),
    );
  }

  if (includesScope(options, 'bases')) {
    blocks.push(
      block('terms-bases-summary', 'summary', 'Resumen Bases', cleanTermsValue({
        objeto: bases.object,
        alcance: bases.scope,
        modalidad: bases.modality,
        presupuesto: bases.reference_budget,
        disclaimer: bases.disclaimer,
      }), 30),
      block('terms-bases-complete', 'table', 'Bases completas', {
        title: 'Bases completas',
        columns: ['Capitulo', 'Numeral', 'Contenido'],
        rows: compactRows([
          { Capitulo: 'Disposiciones generales', Numeral: 'Objeto', Contenido: bases.object },
          { Capitulo: 'Disposiciones generales', Numeral: 'Alcance', Contenido: bases.scope },
          { Capitulo: 'Participantes y requisitos', Numeral: 'Requisitos minimos', Contenido: joinClean(asArray(bases.minimum_supplier_requirements)) },
          { Capitulo: 'Contenido de la propuesta', Numeral: 'Documentos solicitados', Contenido: joinClean(asArray(bases.requested_documentation)) },
          { Capitulo: 'Garantias y seguros', Numeral: 'Garantias', Contenido: joinClean(asArray(document.guarantees_penalties).map((item) => asRecord(item).condition || asRecord(item).item)) },
          { Capitulo: 'Proceso de seleccion', Numeral: 'Condiciones de presentacion', Contenido: joinClean(asArray(bases.proposal_submission_conditions)) },
          { Capitulo: 'Criterios de evaluacion', Numeral: 'Evaluacion', Contenido: joinClean(asArray(bases.evaluation_criteria)) },
          { Capitulo: 'Disposiciones finales', Numeral: 'Descalificacion', Contenido: joinClean(asArray(bases.disqualification_conditions)) },
        ]),
      }, 35),
      block('terms-bases-requirements', 'table', 'Requisitos proveedor', {
        title: 'Requisitos proveedor',
        columns: ['Tipo', 'Detalle'],
        rows: compactRows([
          ...asArray(bases.minimum_supplier_requirements).map((item) => ({ Tipo: 'Requisito minimo', Detalle: item })),
          ...asArray(bases.requested_documentation).map((item) => ({ Tipo: 'Documento solicitado', Detalle: item })),
          ...asArray(bases.evaluation_criteria).map((item) => ({ Tipo: 'Criterio de evaluacion', Detalle: item })),
        ]),
      }, 40),
      block('terms-bases-conditions', 'table', 'Condiciones del concurso', cleanKeyValueTable({
        question_deadline: bases.question_deadline,
        proposal_deadline: bases.proposal_deadline,
        submission_method: bases.submission_method,
        disqualification_conditions: joinClean(asArray(bases.disqualification_conditions)),
      }), 50),
    );
  }

  if (includesScope(options, 'invitacion')) {
    blocks.push(
      block('terms-invitation-email', 'summary', 'Invitacion', cleanTermsValue(email), 30, undefined, 'email-summary'),
      block('terms-invitation-bidders', 'table', 'Postores invitados', cleanTableFromRows(asArray(data.invited_bidders).map(asRecord)), 40),
      block('terms-invitation-dates', 'table', 'Fechas clave', cleanKeyValueTable({
        response_deadline: email.response_deadline,
        question_deadline: bases.question_deadline,
        proposal_deadline: bases.proposal_deadline,
      }), 45),
      block('terms-invitation-contact', 'table', 'Contactos', cleanKeyValueTable({ contacto: email.contact_details }), 50),
    );
  }

  if (includesScope(options, 'cronograma')) {
    const schedule = cleanTableFromRows(asArray(data.process_schedule).map(asRecord));
    blocks.push(
      block('terms-schedule-summary', 'summary', 'Resumen Cronograma', cleanTermsValue(firstRenderable(data.tender_process, data.process_schedule)), 30),
      block('terms-schedule', 'timeline', 'Cronograma completo', schedule, 35),
      block('terms-schedule-phases', 'table', 'Fases', schedule, 40),
      block('terms-schedule-milestones', 'table', 'Hitos criticos', schedule, 45),
      block('terms-schedule-owners', 'table', 'Responsables', schedule, 50),
    );
  }

  if (includesScope(options, 'pendientes') || includesScope(options, 'recomendaciones')) {
    blocks.push(
      block('terms-pending-table', 'table', 'Pendientes y acciones sugeridas', cleanTableFromRows(pendingRows), 80),
      block('terms-buyer-recommendations', 'recommendation', 'Recomendaciones', cleanTermsValue(data.buyer_recommendations), 90),
      block('terms-completion-questions', 'table', 'Preguntas para completar', cleanListTable(asArray(data.recommended_questions), 'Pregunta'), 92),
    );
  }

  return {
    agentId: 'terms_of_reference',
    title,
    subtitle: [text(data.requirement_type), text(data.category), text(data.risk_level)].filter(Boolean).join(' | '),
    blocks,
  };
}
