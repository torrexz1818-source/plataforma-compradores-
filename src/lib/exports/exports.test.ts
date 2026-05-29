import { describe, expect, it } from 'vitest';
import {
  auditDeliverableBeforeDownload,
  buildExportPayload,
  cleanExportBlocks,
  isRenderable,
  type ExportPayload,
} from '@/lib/exports';

const completeDashboard = {
  dashboard_title: 'Dashboard de compras',
  audience: 'Gerencia',
  period: '2026',
  data_type: 'Gastos',
  executive_summary: 'El gasto se concentra en proveedores estrategicos y existen oportunidades de ahorro.',
  kpis: [
    { title: 'Gasto total', value: 'S/ 120,000', description: 'Gasto analizado' },
    { title: 'Proveedores activos', value: '8', description: 'Proveedores con compras' },
  ],
  charts: [
    { title: 'Gasto por proveedor', type: 'bar', data: [{ label: 'Proveedor A', value: 65000 }], insight: 'Proveedor A concentra el mayor gasto.' },
  ],
  tables: [
    { title: 'Ranking proveedores', columns: ['Proveedor', 'Gasto'], rows: [{ Proveedor: 'Proveedor A', Gasto: 65000 }] },
  ],
  insights: [{ title: 'Concentracion', description: 'La concentracion permite negociar mejores condiciones.', recommended_action: 'Negociar acuerdo marco.' }],
  recommendations: ['Renegociar condiciones con los proveedores principales.'],
  suggested_filters: ['Proveedor', 'Categoria'],
  missing_information: [],
};

const completeProposal = {
  analysis_title: 'Comparativo de proveedores',
  service: 'Transporte nacional',
  objective: 'Seleccionar proveedor para rutas recurrentes',
  executive_summary: 'Proveedor A obtiene el mejor balance entre precio, cobertura y riesgo.',
  recommended_supplier: 'Proveedor A',
  suppliers: [
    { supplier_name: 'Proveedor A', total_amount: 'S/ 90,000', risks: ['Capacidad en temporada alta'] },
    { supplier_name: 'Proveedor B', total_amount: 'S/ 96,000', risks: ['Mayor plazo de entrega'] },
  ],
  ranking: [
    { position: 1, supplier_name: 'Proveedor A', score: 92, reason: 'Mejor balance integral', main_strengths: ['Precio'], main_risks: ['Capacidad'] },
    { position: 2, supplier_name: 'Proveedor B', score: 86, reason: 'Buena cobertura', main_strengths: ['Cobertura'], main_risks: ['Plazo'] },
  ],
  evaluation_matrix: {
    criteria: [
      { number: 1, criterion: 'Precio', weight_percent: 40, ratings: { 'Proveedor A': 5, 'Proveedor B': 4 }, observations: 'Proveedor A es mas competitivo.' },
      { number: 2, criterion: 'Cobertura', weight_percent: 30, ratings: { 'Proveedor A': 4, 'Proveedor B': 5 }, observations: 'Ambos cumplen.' },
    ],
    weighted_totals: [
      { supplier_name: 'Proveedor A', weighted_score: 4.7, ranking_position: 1 },
      { supplier_name: 'Proveedor B', weighted_score: 4.3, ranking_position: 2 },
    ],
  },
  executive_comparison_table: [
    { row_label: 'Precio', values: { 'Proveedor A': 'S/ 90,000', 'Proveedor B': 'S/ 96,000' } },
  ],
  comparison_table: [
    { criterion: 'Precio', values: { 'Proveedor A': 'S/ 90,000', 'Proveedor B': 'S/ 96,000' }, comment: 'Proveedor A gana.' },
  ],
  global_risks: ['Capacidad operativa en picos de demanda'],
  missing_information: [],
  questions_for_suppliers: [],
  final_recommendation: 'Adjudicar a Proveedor A sujeto a validacion de capacidad.',
};

const completeTco = {
  analysis_title: 'Analisis TCO equipos',
  item_name: 'Montacargas',
  analysis_type: 'Maquinaria / activo',
  evaluation_horizon: '5 anos',
  comparison_unit: 'Por equipo',
  currency: 'USD',
  executive_summary: {
    best_alternative: 'Alternativa A',
    best_alternative_score: 91,
    best_alternative_score_label: 'Alta',
    why_it_wins: 'Menor costo total y soporte local.',
    estimated_saving_or_overcost: 'Ahorro estimado de USD 12,000',
    main_risk: 'Disponibilidad de repuestos',
    final_recommendation: 'Seleccionar Alternativa A.',
  },
  tco_matrix: [
    { cost_component: 'Adquisicion', values: { 'Alternativa A': 50000, 'Alternativa B': 47000 }, notes: 'Precio base' },
    { cost_component: 'Mantenimiento', values: { 'Alternativa A': 8000, 'Alternativa B': 14000 }, notes: '5 anos' },
  ],
  ranking: [
    { position: 1, alternative: 'Alternativa A', ranking_type: 'TCO', total_tco: 58000, reason: 'Menor TCO' },
    { position: 2, alternative: 'Alternativa B', ranking_type: 'TCO', total_tco: 61000, reason: 'Mayor mantenimiento' },
  ],
  financial_model: [{ Alternativa: 'Alternativa A', TCO: 58000 }, { Alternativa: 'Alternativa B', TCO: 61000 }],
  risk_analysis: [{ Riesgo: 'Repuestos', Impacto: 'Medio', Mitigacion: 'Contrato de soporte' }],
  strategic_recommendation: {
    recommended_action: 'Negociar garantia extendida',
    final_recommended_option: 'Alternativa A',
    recommendation_rationale: 'Mejor balance financiero y operativo.',
    next_steps: ['Validar SLA', 'Cerrar contrato de soporte'],
  },
  missing_information: [],
  questions_for_user_or_suppliers: [],
  assumptions_and_limits: [],
};

const completeTerms = {
  title: 'Contratacion de mantenimiento',
  requirement_type: 'Servicio',
  category: 'Mantenimiento',
  risk_level: 'Medio',
  executive_summary: 'Se requiere contratar mantenimiento preventivo para equipos criticos.',
  dashboard_metrics: [{ label: 'Completitud', value: 'Alta', status: 'complete' }],
  generated_document: {
    objective: 'Contratar mantenimiento preventivo.',
    scope: 'Equipos criticos de planta.',
    justification: 'Reducir paradas no planificadas.',
    final_deliverables: ['Plan de mantenimiento', 'Informe mensual'],
    technical_characteristics: ['Servicio mensual'],
    required_activities: ['Inspeccion', 'Ajustes preventivos'],
    general_data: { requirement_name: 'Mantenimiento preventivo', category: 'Mantenimiento' },
    evaluation_matrix: [{ criterion: 'Experiencia', score: 40, required_evidence: 'Contratos similares' }],
    compliance_matrix: [{ requirement: 'Personal certificado', mandatory: 'Si', expected_evidence: 'Certificados' }],
    identified_risks: [{ risk: 'Parada de equipo', impact: 'Alto', mitigation: 'Planificacion por turnos' }],
  },
  quality_check: { is_complete: true, warnings: [], missing_sections: [] },
  checklist: [{ label: 'Objetivo', status: 'complete', detail: 'Definido' }],
  tender_bases: {
    object: 'Contratar mantenimiento preventivo',
    scope: 'Equipos criticos',
    minimum_supplier_requirements: ['Experiencia de 3 anos'],
    requested_documentation: ['RUC', 'Certificaciones'],
    evaluation_criteria: ['Precio', 'Experiencia'],
    question_deadline: '2026-06-10',
    proposal_deadline: '2026-06-20',
    submission_method: 'Correo electronico',
  },
  supplier_invitation_email: {
    subject: 'Invitacion a presentar propuesta',
    greeting: 'Estimados proveedores',
    body: 'Los invitamos a presentar propuesta tecnica y economica.',
    attached_documents: ['TDR', 'Bases'],
    response_deadline: '2026-06-20',
    contact_details: 'compras@empresa.com',
    closing: 'Saludos',
  },
  invited_bidders: [{ business_name: 'Proveedor A', email: 'ventas@proveedora.com' }],
  process_schedule: [
    { phase: 'Convocatoria', activity: 'Enviar invitacion', start: '2026-06-01', end: '2026-06-01' },
    { phase: 'Evaluacion', activity: 'Comparar propuestas', start: '2026-06-21', end: '2026-06-25' },
  ],
  missing_information: [],
  buyer_recommendations: ['Validar disponibilidad presupuestal'],
};

function expectPublicPayload(payload: ExportPayload) {
  const serialized = JSON.stringify(payload);
  const forbiddenKeys = ['metadata', 'source_component', 'llm_used', 'dataProfile', 'dashboardPlan'];
  forbiddenKeys.forEach((key) => expect(serialized).not.toContain(`"${key}"`));

  const stringValues: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === 'string') {
      stringValues.push(value);
      return;
    }
    if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach(collect);
  };
  collect(payload);
  const publicText = stringValues.join(' | ');
  expect(publicText).not.toMatch(/\b(null|undefined|NaN|dato faltante|N\/A|\[COMPLETAR\]|\[SUGERIDO\])\b/i);
  expect(publicText).not.toMatch(/\b(Python|LLM|prompt|script|procesamiento interno|extracci[oó]n de PDF)\b/i);
}

function expectFormatsHaveRenderableBlocks(payload: ExportPayload) {
  expect(cleanExportBlocks(payload.blocks, 'pdf').length).toBeGreaterThan(0);
  expect(cleanExportBlocks(payload.blocks, 'excel').length).toBeGreaterThan(0);
  expect(cleanExportBlocks(payload.blocks, 'ppt').length).toBeGreaterThan(0);
}

describe('exports shared layer', () => {
  it('marks meaningful values as renderable and placeholders as non-renderable', () => {
    expect(isRenderable(null)).toBe(false);
    expect(isRenderable('No especificado')).toBe(false);
    expect(isRenderable('[COMPLETAR]')).toBe(false);
    expect(isRenderable([])).toBe(false);
    expect(isRenderable({})).toBe(false);
    expect(isRenderable('Ahorro potencial')).toBe(true);
  });

  it('does not remove valid business words that only contain a technical substring', () => {
    const report = auditDeliverableBeforeDownload({
      agentKey: 'dashboard_creator',
      result: {
        ...completeDashboard,
        executive_summary: 'Reporte descriptivo del gasto y proveedores principales.',
      },
    });
    expect(JSON.stringify(report.sanitizedPayload)).toContain('descriptivo');
    expect(report.status).toBe('approved');
  });

  it('approves a complete dashboard payload', () => {
    const report = auditDeliverableBeforeDownload({ agentKey: 'dashboard_creator', result: completeDashboard });
    expect(report.status).toBe('approved');
    expect(report.sanitizedPayload.blocks.length).toBeGreaterThan(4);
    expectPublicPayload(report.sanitizedPayload);
    expectFormatsHaveRenderableBlocks(report.sanitizedPayload);
  });

  it('allows optional missing data with warnings', () => {
    const report = auditDeliverableBeforeDownload({
      agentKey: 'dashboard_creator',
      result: { ...completeDashboard, recommendations: [], missing_information: ['Validar presupuesto por categoria'] },
    });
    expect(report.status).toBe('approved_with_warnings');
    expect(report.missingFields.optional).toContain('Validar presupuesto por categoria');
  });

  it('approves a complete proposal comparison and keeps useful ranking, matrix and recommendation', () => {
    const report = auditDeliverableBeforeDownload({ agentKey: 'proposal_comparison', result: completeProposal });
    const ids = report.sanitizedPayload.blocks.map((block) => block.id);
    expect(report.status).toBe('approved');
    expect(ids).toEqual(expect.arrayContaining(['proposal-ranking', 'proposal-evaluation-matrix', 'proposal-final-recommendation']));
    expectPublicPayload(report.sanitizedPayload);
    expectFormatsHaveRenderableBlocks(report.sanitizedPayload);
  });

  it('allows proposal comparison with optional missing fields under warning', () => {
    const report = auditDeliverableBeforeDownload({
      agentKey: 'proposal_comparison',
      result: { ...completeProposal, missing_information: ['Confirmar vigencia de propuesta B'] },
    });
    expect(report.status).toBe('approved_with_warnings');
    expect(report.suggestions).toContain('Confirmar vigencia de propuesta B');
  });

  it('approves a complete TCO result and preserves financial decision blocks', () => {
    const report = auditDeliverableBeforeDownload({ agentKey: 'tco_analysis', result: completeTco });
    const ids = report.sanitizedPayload.blocks.map((block) => block.id);
    expect(report.status).toBe('approved');
    expect(ids).toEqual(expect.arrayContaining(['tco-matrix', 'tco-scorecard', 'tco-decision']));
    expectPublicPayload(report.sanitizedPayload);
    expectFormatsHaveRenderableBlocks(report.sanitizedPayload);
  });

  it('blocks TCO when critical matrix and ranking data are missing', () => {
    const report = auditDeliverableBeforeDownload({
      agentKey: 'tco_analysis',
      result: { ...completeTco, tco_matrix: [], financial_model: [], ranking: [] },
    });
    expect(report.status).toBe('blocked');
    expect(report.criticalIssues).toEqual(expect.arrayContaining([
      'Matriz de costos o modelo financiero TCO',
      'Ranking o comparacion clara de alternativas',
    ]));
  });

  it('keeps dashboard useful when a table is incomplete and removes placeholder cells', () => {
    const report = auditDeliverableBeforeDownload({
      agentKey: 'dashboard_creator',
      result: {
        ...completeDashboard,
        tables: [
          {
            title: 'Tabla incompleta',
            columns: ['Proveedor', 'Monto', 'Comentario'],
            rows: [
              { Proveedor: 'Proveedor A', Monto: 12000, Comentario: 'N/A' },
              { Proveedor: 'N/A', Monto: 'N/A', Comentario: '[COMPLETAR]' },
            ],
          },
        ],
      },
    });
    const tableBlock = report.sanitizedPayload.blocks.find((block) => block.id === 'dashboard-tables');
    expect(report.status).toBe('approved_with_warnings');
    expect(JSON.stringify(tableBlock)).toContain('Proveedor A');
    expectPublicPayload(report.sanitizedPayload);
  });

  it('blocks when critical data is missing', () => {
    const payload: ExportPayload = { agentId: 'dashboard_creator', title: '', blocks: [] };
    const report = auditDeliverableBeforeDownload(payload);
    expect(report.status).toBe('blocked');
    expect(report.missingFields.critical.length).toBeGreaterThan(0);
  });

  it('cleans tables with repeated placeholders instead of exporting empty rows', () => {
    const payload: ExportPayload = {
      agentId: 'generic',
      title: 'Comparativo',
      blocks: [
        {
          id: 'table',
          type: 'table',
          title: 'Tabla',
          priority: 1,
          data: {
            columns: ['Proveedor', 'Precio', 'Comentario'],
            rows: [
              { Proveedor: 'Proveedor A', Precio: 'N/A', Comentario: 'No especificado' },
              { Proveedor: 'N/A', Precio: 'N/A', Comentario: 'N/A' },
            ],
          },
        },
      ],
    };
    const report = auditDeliverableBeforeDownload(payload);
    const table = report.sanitizedPayload.blocks[0].data as { columns: string[]; rows: Array<Record<string, unknown>> };
    expect(report.status).toBe('approved_with_warnings');
    expect(table.columns).toEqual(['Proveedor']);
    expect(table.rows).toEqual([{ Proveedor: 'Proveedor A' }]);
  });

  it('removes forbidden technical terms from public payloads', () => {
    const report = auditDeliverableBeforeDownload({
      agentKey: 'dashboard_creator',
      result: {
        ...completeDashboard,
        executive_summary: 'Analisis ejecutivo listo.',
        recommendations: ['Usar prompt interno y script Python'],
        dataProfile: { columns: ['interno'] },
        dashboardPlan: { prompt: 'interno' },
        llm_used: true,
        source_component: 'internal',
      },
    });
    const serialized = JSON.stringify(report.sanitizedPayload);
    expectPublicPayload(report.sanitizedPayload);
  });

  it('filters blocks per format so empty Excel sheets and PPT slides are not created', () => {
    const payload: ExportPayload = {
      agentId: 'generic',
      title: 'Reporte',
      blocks: [
        { id: 'empty', type: 'table', title: 'Vacia', priority: 1, data: [] },
        { id: 'pdf-only', type: 'summary', title: 'Resumen', priority: 2, data: 'Valor', formats: ['pdf'] },
        { id: 'excel', type: 'table', title: 'Datos', priority: 3, data: [{ Campo: 'A', Valor: 1 }], formats: ['excel'] },
      ],
    };
    expect(cleanExportBlocks(payload.blocks, 'ppt')).toHaveLength(0);
    expect(cleanExportBlocks(payload.blocks, 'excel')).toHaveLength(1);
  });

  it('keeps TDR scopes separated by document', () => {
    const payload = buildExportPayload('terms_of_reference', completeTerms, {
      termsScope: { documentCode: 'INV-03', documentTitle: 'Invitacion', sections: ['invitacion'] },
    });
    const ids = payload.blocks.map((block) => block.id);
    expect(ids).toContain('terms-invitation-email');
    expect(ids).not.toContain('terms-bases-summary');
    expect(ids).not.toContain('terms-document-deliverables');
  });

  it('keeps TDR, bases, invitation and schedule scopes isolated', () => {
    const cases = [
      {
        scope: { documentCode: 'TDR-01', documentTitle: 'Terminos de Referencia', sections: ['tdr', 'matrizRiesgos', 'calidad'] },
        expected: ['terms-document-deliverables', 'terms-evaluation-matrix', 'terms-quality'],
        forbidden: ['terms-bases-summary', 'terms-invitation-email', 'terms-schedule'],
      },
      {
        scope: { documentCode: 'BC-01', documentTitle: 'Bases del Concurso', sections: ['bases'] },
        expected: ['terms-bases-summary', 'terms-bases-requirements'],
        forbidden: ['terms-document-deliverables', 'terms-invitation-email', 'terms-schedule'],
      },
      {
        scope: { documentCode: 'INV-03', documentTitle: 'Invitacion', sections: ['invitacion'] },
        expected: ['terms-invitation-email'],
        forbidden: ['terms-document-deliverables', 'terms-bases-summary', 'terms-schedule'],
      },
      {
        scope: { documentCode: 'CRO-04', documentTitle: 'Cronograma', sections: ['cronograma'] },
        expected: ['terms-schedule'],
        forbidden: ['terms-document-deliverables', 'terms-bases-summary', 'terms-invitation-email'],
      },
    ];

    cases.forEach(({ scope, expected, forbidden }) => {
      const report = auditDeliverableBeforeDownload({
        agentKey: 'terms_of_reference',
        result: completeTerms,
        options: { termsScope: scope },
      });
      const ids = report.sanitizedPayload.blocks.map((block) => block.id);
      expect(report.status).not.toBe('blocked');
      expected.forEach((id) => expect(ids).toContain(id));
      forbidden.forEach((id) => expect(ids).not.toContain(id));
      expectPublicPayload(report.sanitizedPayload);
      expectFormatsHaveRenderableBlocks(report.sanitizedPayload);
    });
  });
});
