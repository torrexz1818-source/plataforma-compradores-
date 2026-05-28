import { describe, expect, it } from 'vitest';
import { auditDeliverableBeforeDownload } from '@/lib/deliverableQuality';

describe('deliverable quality audit', () => {
  it('approves a complete dashboard deliverable', () => {
    const report = auditDeliverableBeforeDownload({
      agentKey: 'dashboard_creator',
      result: {
        executive_summary: 'Resumen ejecutivo claro.',
        kpis: [{ title: 'Ahorro', value: '12%', description: 'Ahorro estimado' }],
        charts: [{ title: 'Gasto por proveedor', data: [{ label: 'A', value: 10 }] }],
        tables: [{ title: 'Top proveedores', columns: ['Proveedor', 'Monto'], rows: [{ Proveedor: 'ABC', Monto: 100 }] }],
        insights: [{ title: 'Concentracion', description: 'Hay concentracion relevante.' }],
        recommendations: ['Negociar con proveedores principales.'],
      },
    });

    expect(report.status).toBe('approved');
    expect(report.criticalIssues).toHaveLength(0);
  });

  it('approves with warnings when optional information is missing', () => {
    const report = auditDeliverableBeforeDownload({
      agentKey: 'proposal_comparison',
      result: {
        executive_summary: 'Comparativo realizado con informacion disponible.',
        suppliers: [
          { supplier_name: 'Proveedor A', total_amount: 'N/A' },
          { supplier_name: 'Proveedor B', total_amount: 'sin informacion' },
        ],
        comparison_table: [{ criterion: 'Precio', values: { 'Proveedor A': 'N/A', 'Proveedor B': 'N/A' }, comment: 'No concluyente' }],
        ranking: [],
        missing_information: ['precios unitarios', 'plazos de entrega'],
        questions_for_suppliers: ['Confirmar precio final.'],
      },
    });

    expect(report.status).toBe('approved_with_warnings');
    expect(report.missingFields.optional).toContain('precios unitarios');
  });

  it('blocks a deliverable with critical missing information', () => {
    const report = auditDeliverableBeforeDownload({
      agentKey: 'tco_analysis',
      result: {
        executive_summary: { final_recommendation: '' },
        tco_matrix: [],
        ranking: [],
      },
    });

    expect(report.status).toBe('blocked');
    expect(report.missingFields.critical).toContain('Matriz de costos o modelo financiero TCO');
  });

  it('sanitizes repetitive missing placeholders in tables', () => {
    const report = auditDeliverableBeforeDownload({
      agentKey: 'dashboard_creator',
      result: {
        executive_summary: 'Resumen.',
        kpis: [{ title: 'Gasto total', value: '100' }],
        charts: [{ title: 'Gasto', data: [{ label: 'A', value: 100 }] }],
        tables: [{
          title: 'Tabla ejecutiva',
          columns: ['Proveedor', 'Precio', 'Vacio'],
          rows: [
            { Proveedor: 'A', Precio: 'dato faltante', Vacio: 'N/A' },
            { Proveedor: 'B', Precio: 'sin informacion', Vacio: 'null' },
            { Proveedor: 'C', Precio: 'no disponible', Vacio: 'undefined' },
          ],
        }],
        recommendations: ['Completar precios.'],
      },
    });

    const table = (report.sanitizedContent.tables as Array<{ columns: string[]; rows: Array<Record<string, unknown>> }>)[0];
    expect(table.columns).toEqual(['Proveedor']);
    expect(JSON.stringify(report.sanitizedContent)).not.toMatch(/dato faltante|N\/A|undefined|null/i);
    expect(report.warnings.join(' ')).toMatch(/campos complementarios/i);
  });

  it('removes internal technical information before export', () => {
    const report = auditDeliverableBeforeDownload({
      agentKey: 'dashboard_creator',
      result: {
        executive_summary: 'Resumen ejecutivo.',
        model_name: 'internal-model',
        notes: ['Procesamiento tecnico con Python'],
        kpis: [{ title: 'Gasto', value: '100' }],
        charts: [{ title: 'Gasto', data: [{ label: 'A', value: 100 }] }],
        recommendations: ['Revisar tendencia.'],
      },
    });

    expect(JSON.stringify(report.sanitizedContent)).not.toMatch(/python|model_name|procesamiento tecnico/i);
    expect(report.status).toBe('approved_with_warnings');
  });
});
