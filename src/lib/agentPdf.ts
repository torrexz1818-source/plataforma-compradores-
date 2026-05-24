import jsPDF from 'jspdf';
import type { AgentPdfMode, AgentPdfOptions } from '@/types';

export type AgentExportFormat = 'pdf' | 'docx' | 'pptx' | 'xlsx';
type DocxModule = typeof import('docx');
type XlsxModule = typeof import('xlsx');
type DocxChild = import('docx').Paragraph | import('docx').Table;
type PptxSlide = import('pptxgenjs').Slide;

type PdfInput = {
  title: string;
  agentName?: string;
  userName?: string;
  result: unknown;
  fileName?: string;
  pdfMode?: AgentPdfMode;
  pdfOptions?: AgentPdfOptions;
};

export type AgentExportInput = PdfInput & {
  format: AgentExportFormat;
};

type PdfContext = {
  doc: jsPDF;
  marginX: number;
  pageWidth: number;
  pageHeight: number;
  maxWidth: number;
  primaryColor: string;
  mode: AgentPdfMode;
  options?: AgentPdfOptions;
  y: number;
};

const labelMap: Record<string, string> = {
  analysis_title: 'Titulo del analisis',
  dashboard_title: 'Titulo del dashboard',
  title: 'Titulo',
  service: 'Servicio evaluado',
  objective: 'Objetivo del analisis',
  audience: 'Audiencia',
  period: 'Periodo',
  data_type: 'Tipo de datos',
  analysis_type: 'Tipo de analisis',
  analysis_mode: 'Modo de analisis',
  confidence_level: 'Nivel de confianza',
  data_understanding: 'Entendimiento de datos',
  data_profile: 'Perfil y calidad de datos',
  executive_summary: 'Resumen ejecutivo',
  summary: 'Resumen',
  generated_document: 'Documento generado',
  detected_alternatives: 'Alternativas detectadas',
  source_files: 'Archivos procesados',
  document_summaries: 'Resumen de documentos procesados',
  supporting_documents_summary: 'Resumen de documentos procesados',
  extracted_data_quality: 'Calidad de extraccion',
  data_used: 'Datos usados',
  kpis: 'KPIs principales',
  charts: 'Graficos',
  tables: 'Tablas',
  tco_matrix: 'Matriz TCO comparativa',
  tco_totals: 'Totales TCO',
  ranking: 'Ranking',
  interpretation: 'Interpretacion',
  hidden_costs_detected: 'Costos ocultos detectados',
  risk_analysis: 'Analisis de riesgos',
  sensitivity_analysis: 'Analisis de sensibilidad',
  strategic_recommendation: 'Recomendacion estrategica',
  insights: 'Insights',
  recommendations: 'Recomendaciones',
  recommended_supplier: 'Proveedor recomendado',
  supplier_name: 'Proveedor',
  weighted_score: 'Puntaje ponderado',
  ranking_position: 'Posicion',
  main_strengths: 'Fortalezas principales',
  main_risks: 'Riesgos principales',
  missing_information: 'Informacion faltante',
  questions_for_suppliers: 'Preguntas para proveedores',
  final_recommendation: 'Recomendacion final',
  criterion: 'Criterio',
  weight_percent: 'Peso',
  observations: 'Observacion',
  verification_source: 'Fuente de verificacion',
  evaluation_scale_description: 'Que evalua',
  row_label: 'Aspecto',
  total_amount: 'Precio',
  payment_terms: 'Forma de pago',
  warranty: 'Garantia',
  certifications: 'Certificaciones',
  included_services: 'Alcance',
  risks: 'Riesgos',
  strengths: 'Fortalezas',
  contact: 'Contacto',
  ruc: 'RUC',
};

const sectionOrder = [
  'dashboard_title',
  'analysis_title',
  'title',
  'objective',
  'audience',
  'period',
  'data_type',
  'analysis_type',
  'analysis_mode',
  'confidence_level',
  'data_understanding',
  'data_profile',
  'executive_summary',
  'summary',
  'generated_document',
  'detected_alternatives',
  'source_files',
  'document_summaries',
  'supporting_documents_summary',
  'extracted_data_quality',
  'data_used',
  'kpis',
  'charts',
  'tables',
  'tco_matrix',
  'tco_totals',
  'ranking',
  'interpretation',
  'hidden_costs_detected',
  'risk_analysis',
  'sensitivity_analysis',
  'strategic_recommendation',
  'observations',
  'insights',
  'recommendations',
  'missing_information',
  'questions_for_user_or_suppliers',
  'questions_for_suppliers',
  'final_recommendation',
  'assumptions_and_limits',
  'suggested_filters',
  'layout_suggestion',
  'disclaimer',
];

const technicalKeys = new Set([
  'pdf_available',
  'llm_used',
  'model_provider',
  'model_name',
  'tokens_input',
  'tokens_output',
  'cost_input',
  'cost_output',
  'cost_total',
  'latency_ms',
]);

function formatLabel(value: string) {
  return labelMap[value] ?? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown, fallback = 'No especificado') {
  if (value === null || value === undefined || value === '') return fallback;
  if (Array.isArray(value)) return value.map((item) => asText(item, '')).filter(Boolean).join(', ') || fallback;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function isEmptyValue(value: unknown) {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length);
}

function shortText(value: unknown, max = 180) {
  const text = asText(value, '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text || 'No especificado';
}

function formatDate() {
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
}

function getDefaultFileName(input: PdfInput, extension: AgentExportFormat) {
  const base = (input.fileName || input.title || 'resultado-nodus-ia')
    .replace(/\.[a-z0-9]+$/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'resultado-nodus-ia';
  return `${base}.${extension}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getFooter(mode: AgentPdfMode, options?: AgentPdfOptions) {
  if (mode === 'standard_branded') return 'Generado por Buyer Nodus - Nodus IA';
  if (mode === 'custom_brand') return options?.branding.footerText || `Generado para ${options?.branding.companyName || 'tu empresa'}`;
  return 'Documento generado por asistente de inteligencia artificial';
}

function getBrandName(mode: AgentPdfMode, options?: AgentPdfOptions) {
  if (mode === 'white_label') return '';
  if (mode === 'custom_brand') return options?.branding.companyName || 'Documento corporativo';
  return 'Buyer Nodus';
}

function getFooterLeft(mode: AgentPdfMode, options?: AgentPdfOptions) {
  if (mode === 'white_label') return '';
  return getBrandName(mode, options) || 'Buyer Nodus';
}

function getFooterRight(mode: AgentPdfMode, options?: AgentPdfOptions) {
  if (mode === 'white_label') return 'Documento generado';
  if (mode === 'custom_brand') return options?.branding.footerText || `Generado para ${options?.branding.companyName || 'tu empresa'}`;
  return 'Generado por Buyer Nodus';
}

function createContext(input: PdfInput): PdfContext {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const marginX = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  return {
    doc,
    marginX,
    pageWidth,
    pageHeight,
    maxWidth: pageWidth - marginX * 2,
    primaryColor: input.pdfOptions?.branding.primaryColor || '#09008B',
    mode: input.pdfMode ?? 'standard_branded',
    options: input.pdfOptions,
    y: 16,
  };
}

function addFooter(ctx: PdfContext) {
  const { doc, marginX, pageWidth, pageHeight, mode, options } = ctx;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor('#64748b');
  const left = getFooterLeft(mode, options);
  if (left) doc.text(left, marginX, pageHeight - 8);
  doc.text(`${getFooterRight(mode, options)} | Pagina ${doc.getNumberOfPages()}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
}

function ensurePage(ctx: PdfContext, needed = 12) {
  if (ctx.y + needed <= ctx.pageHeight - 16) return;
  addFooter(ctx);
  ctx.doc.addPage();
  ctx.y = 16;
}

function addText(ctx: PdfContext, text: string, options: { size?: number; bold?: boolean; color?: string; width?: number; gap?: number } = {}) {
  const { doc } = ctx;
  const size = options.size ?? 9;
  doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(options.color ?? '#111827');
  const lines = doc.splitTextToSize(text, options.width ?? ctx.maxWidth);
  lines.forEach((line: string) => {
    ensurePage(ctx, size >= 14 ? 9 : 6);
    doc.text(line, ctx.marginX, ctx.y);
    ctx.y += size >= 14 ? 7 : 5;
  });
  ctx.y += options.gap ?? 0;
}

function addSection(ctx: PdfContext, title: string) {
  ensurePage(ctx, 12);
  ctx.y += 2;
  addText(ctx, title, { size: 12, bold: true, color: ctx.primaryColor, gap: 1 });
}

function addHeader(ctx: PdfContext, input: PdfInput, subtitle?: string) {
  const { doc } = ctx;
  doc.setFillColor(ctx.primaryColor);
  doc.roundedRect(ctx.marginX, ctx.y, ctx.maxWidth, 28, 3, 3, 'F');
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(input.title, ctx.marginX + 6, ctx.y + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const brand =
    ctx.mode === 'standard_branded'
      ? 'Buyer Nodus - Nodus IA'
      : ctx.mode === 'custom_brand'
        ? input.pdfOptions?.branding.companyName || 'Documento corporativo'
        : 'Reporte profesional';
  doc.text(`${brand} | ${input.agentName || input.title}`, ctx.marginX + 6, ctx.y + 17);
  doc.text(`Fecha: ${formatDate()} | Formato: PDF`, ctx.marginX + 6, ctx.y + 23);
  ctx.y += 35;
  if (input.userName || input.pdfOptions?.branding.companyName || subtitle) {
    addText(ctx, `Usuario/empresa: ${input.userName || input.pdfOptions?.branding.companyName || 'No especificado'}`, {
      size: 9,
      color: '#475569',
    });
    if (subtitle) addText(ctx, subtitle, { size: 9, color: '#475569', gap: 2 });
  }
}

function addCard(ctx: PdfContext, title: string, body: string | string[], tone: 'blue' | 'green' | 'amber' = 'blue') {
  const fill = tone === 'green' ? '#ecfdf5' : tone === 'amber' ? '#fffbeb' : '#eef2ff';
  const stroke = tone === 'green' ? '#a7f3d0' : tone === 'amber' ? '#fde68a' : '#c7d2fe';
  const titleColor = tone === 'green' ? '#047857' : tone === 'amber' ? '#92400e' : ctx.primaryColor;
  const lines = Array.isArray(body) ? body : [body];
  const textLines = lines.flatMap((line) => ctx.doc.splitTextToSize(line, ctx.maxWidth - 12));
  const height = Math.max(22, 11 + textLines.length * 5);
  ensurePage(ctx, height + 4);
  ctx.doc.setFillColor(fill);
  ctx.doc.setDrawColor(stroke);
  ctx.doc.roundedRect(ctx.marginX, ctx.y, ctx.maxWidth, height, 3, 3, 'FD');
  ctx.y += 7;
  addText(ctx, title, { size: 10.5, bold: true, color: titleColor, width: ctx.maxWidth - 12, gap: 1 });
  lines.forEach((line) => addText(ctx, line, { size: 8.8, color: '#334155', width: ctx.maxWidth - 12 }));
  ctx.y += 5;
}

function addBulletList(ctx: PdfContext, title: string, items: unknown[], limit = 5) {
  const values = items.map((item) => shortText(item, 170)).filter(Boolean).slice(0, limit);
  if (!values.length) return;
  addText(ctx, title, { size: 9.2, bold: true, color: '#0f172a' });
  values.forEach((item) => addText(ctx, `- ${item}`, { size: 8.5, color: '#475569' }));
}

function addTable(ctx: PdfContext, headers: string[], rows: unknown[][], widths?: number[]) {
  if (!rows.length) return;
  const { doc } = ctx;
  const colWidths = widths ?? headers.map(() => ctx.maxWidth / headers.length);
  const headerHeight = 8;
  const drawHeader = () => {
    ensurePage(ctx, headerHeight + 4);
    doc.setFillColor('#eef2ff');
    doc.setDrawColor('#cbd5e1');
    doc.rect(ctx.marginX, ctx.y, ctx.maxWidth, headerHeight, 'FD');
    let x = ctx.marginX;
    headers.forEach((header, index) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(ctx.primaryColor);
      doc.text(doc.splitTextToSize(header, colWidths[index] - 3), x + 1.5, ctx.y + 5);
      x += colWidths[index];
    });
    ctx.y += headerHeight;
  };

  drawHeader();
  rows.forEach((row, rowIndex) => {
    const cells = row.map((cell, index) => doc.splitTextToSize(shortText(cell, 220), colWidths[index] - 3));
    const rowHeight = Math.max(8, ...cells.map((cell) => cell.length * 4.2 + 3));
    if (ctx.y + rowHeight > ctx.pageHeight - 16) {
      addFooter(ctx);
      doc.addPage();
      ctx.y = 16;
      drawHeader();
    }
    doc.setFillColor(rowIndex % 2 ? '#f8fafc' : '#ffffff');
    doc.setDrawColor('#e2e8f0');
    doc.rect(ctx.marginX, ctx.y, ctx.maxWidth, rowHeight, 'FD');
    let x = ctx.marginX;
    cells.forEach((cell, index) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      doc.setTextColor('#334155');
      doc.text(cell, x + 1.5, ctx.y + 5);
      x += colWidths[index];
    });
    ctx.y += rowHeight;
  });
  ctx.y += 4;
}

function orderedResultEntries(result: Record<string, unknown>) {
  const used = new Set<string>();
  const ordered: [string, unknown][] = [];
  sectionOrder.forEach((key) => {
    if (key in result && !technicalKeys.has(key) && !isEmptyValue(result[key])) {
      ordered.push([key, result[key]]);
      used.add(key);
    }
  });
  Object.entries(result).forEach(([key, value]) => {
    if (!used.has(key) && !technicalKeys.has(key) && !isEmptyValue(value)) ordered.push([key, value]);
  });
  return ordered;
}

function chartRows(value: unknown) {
  return asArray(value).map((chart) => {
    const record = asRecord(chart);
    const points = asArray(record.data)
      .map((item) => {
        const point = asRecord(item);
        if (!Object.keys(point).length) return asText(item, '');
        const label = point.label ?? point.x ?? point.name ?? 'Dato';
        const amount = point.value ?? point.y ?? point.amount ?? 'No especificado';
        return `${asText(label)}: ${asText(amount)}`;
      })
      .filter(Boolean)
      .join('; ');
    return {
      chart: record.title,
      type: record.type,
      source: record.data_source ?? record.source,
      confidence: record.confidence,
      data: points || 'Sin datos tabulares',
      insight: record.insight ?? record.description,
    };
  });
}

function getRecommendedRanking(result: Record<string, unknown>) {
  const recommended = asText(result.recommended_supplier, '');
  const ranking = asArray(result.ranking).map(asRecord);
  return ranking.find((item) => asText(item.supplier_name, '') === recommended) ?? ranking[0] ?? {};
}

function addProposalComparisonPdf(input: PdfInput) {
  const result = asRecord(input.result);
  const ctx = createContext(input);
  const suppliers = asArray(result.suppliers).map(asRecord);
  const ranking = asArray(result.ranking).map(asRecord);
  const recommended = getRecommendedRanking(result);
  const recommendedName = asText(result.recommended_supplier || recommended.supplier_name, 'No especificado');
  const subtitle = `Servicio evaluado: ${asText(result.service)} | Objetivo: ${shortText(result.objective, 120)}`;

  addHeader(ctx, input, subtitle);
  addCard(ctx, 'Resumen ejecutivo', [
    `Propuestas evaluadas: ${suppliers.length}`,
    `Proveedor recomendado: ${recommendedName}`,
    `Motivo principal: ${shortText(recommended.reason || result.executive_summary, 210)}`,
    `Riesgo principal: ${shortText(asArray(recommended.main_risks)[0] || asArray(result.global_risks)[0], 160)}`,
  ]);

  addCard(ctx, 'Proveedor recomendado', [
    `${recommendedName}`,
    `Puntaje: ${asText(recommended.weighted_score ?? recommended.score, 'Sin puntaje')} / 5`,
    `Por que gana: ${shortText(recommended.reason, 220)}`,
  ], 'green');
  addBulletList(ctx, 'Fortalezas clave', asArray(recommended.main_strengths));
  addBulletList(ctx, 'Riesgos a validar', asArray(recommended.main_risks));

  addSection(ctx, 'Ranking de proveedores');
  addTable(
    ctx,
    ['Posicion', 'Proveedor', 'Puntaje ponderado', 'Nivel', 'Motivo breve'],
    ranking.map((item, index) => [
      item.position ?? index + 1,
      item.supplier_name,
      item.weighted_score ?? item.score,
      index === 0 ? 'Recomendado' : index === 1 ? 'Alternativa viable' : 'Requiere validacion',
      item.reason,
    ]),
    [18, 38, 31, 32, ctx.maxWidth - 119],
  );

  const matrix = asRecord(result.evaluation_matrix);
  const criteria = asArray(matrix.criteria).map(asRecord);
  if (criteria.length && suppliers.length) {
    addSection(ctx, 'Matriz de evaluacion comparativa');
    const supplierNames = suppliers.map((supplier) => asText(supplier.supplier_name));
    addTable(
      ctx,
      ['N', 'Criterio', 'Peso', ...supplierNames, 'Observacion'],
      criteria.map((criterion) => {
        const ratings = asRecord(criterion.ratings);
        return [
          criterion.number,
          criterion.criterion,
          `${asText(criterion.weight_percent)}%`,
          ...supplierNames.map((name) => `${asText(ratings[name], '-')}/5`),
          criterion.observations,
        ];
      }),
      [10, 34, 16, ...supplierNames.map(() => 22), ctx.maxWidth - 60 - supplierNames.length * 22],
    );
  }

  addSection(ctx, 'Puntaje ponderado total');
  addTable(
    ctx,
    ['Proveedor', 'Puntaje ponderado', 'Posicion'],
    asArray(matrix.weighted_totals).map((item) => {
      const total = asRecord(item);
      return [total.supplier_name, total.weighted_score, total.ranking_position];
    }),
    [70, 55, 35],
  );

  const criteriaGuide = asArray(result.criteria_guide).map(asRecord);
  if (criteriaGuide.length) {
    addSection(ctx, 'Guia de criterios');
    addTable(
      ctx,
      ['Criterio', 'Peso', 'Que evalua', 'Fuente de verificacion'],
      criteriaGuide.map((item) => [item.criterion, `${asText(item.weight_percent)}%`, item.evaluation_scale_description, item.verification_source]),
      [40, 18, 65, ctx.maxWidth - 123],
    );
  }

  const executiveRows = asArray(result.executive_comparison_table).map(asRecord);
  if (executiveRows.length) {
    addSection(ctx, 'Comparativo ejecutivo');
    const supplierNames = suppliers.map((supplier) => asText(supplier.supplier_name));
    addTable(
      ctx,
      ['Aspecto', ...supplierNames],
      executiveRows.map((row) => {
        const values = asRecord(row.values);
        return [row.row_label, ...supplierNames.map((name) => values[name] ?? 'No especificado')];
      }),
      [36, ...supplierNames.map(() => (ctx.maxWidth - 36) / Math.max(supplierNames.length, 1))],
    );
  }

  addSection(ctx, 'Ficha resumida por proveedor');
  suppliers.forEach((supplier) => {
    addCard(ctx, asText(supplier.supplier_name), [
      `RUC: ${asText(supplier.ruc)}`,
      `Contacto: ${asText(supplier.contact || supplier.email || supplier.phone)}`,
      `Precio: ${asText(supplier.total_amount)} ${asText(supplier.currency, '')}`.trim(),
      `Forma de pago: ${asText(supplier.payment_terms)}`,
      `Garantia: ${asText(supplier.warranty)}`,
    ]);
    addBulletList(ctx, 'Fortalezas', asArray(supplier.strengths));
    addBulletList(ctx, 'Riesgos', asArray(supplier.risks));
    addBulletList(ctx, 'Informacion faltante', asArray(supplier.missing_information));
  });

  addSection(ctx, 'Riesgos globales');
  addCard(ctx, 'Alertas principales', asArray(result.global_risks).slice(0, 5).map((item) => `- ${shortText(item, 180)}`).join('\n') || 'Sin riesgos globales registrados.', 'amber');

  addSection(ctx, 'Informacion faltante');
  addBulletList(ctx, 'Datos a solicitar o validar', asArray(result.missing_information), 8);

  addSection(ctx, 'Preguntas para proveedores');
  addTable(
    ctx,
    ['Proveedor', 'Pregunta'],
    asArray(result.questions_for_suppliers).map((question) => {
      const text = asText(question);
      const supplier = suppliers.find((item) => text.toLowerCase().includes(asText(item.supplier_name, '').toLowerCase()));
      return [supplier?.supplier_name ?? 'General', text];
    }),
    [50, ctx.maxWidth - 50],
  );

  addCard(ctx, 'Recomendacion final', asText(result.final_recommendation), 'green');
  addAdditionalResultSections(ctx, result, [
    'recommended_supplier',
    'executive_summary',
    'suppliers',
    'ranking',
    'evaluation_matrix',
    'criteria_guide',
    'executive_comparison_table',
    'global_risks',
    'missing_information',
    'questions_for_suppliers',
    'final_recommendation',
    'disclaimer',
  ]);
  addSection(ctx, 'Disclaimer');
  addText(ctx, asText(result.disclaimer, 'Documento generado por Nodus IA como apoyo a decisiones de compra. Validar datos criticos antes de tomar decisiones finales.'), {
    size: 8.5,
    color: '#64748b',
  });
  addFooter(ctx);
  ctx.doc.save(input.fileName ?? 'comparativo-propuestas-nodus-ia.pdf');
}

function addAdditionalResultSections(ctx: PdfContext, result: Record<string, unknown>, coveredKeys: string[]) {
  const covered = new Set(coveredKeys);
  orderedResultEntries(result).forEach(([key, value]) => {
    if (covered.has(key) || key === 'disclaimer') return;
    addSection(ctx, formatLabel(key));
    addValueBlock(ctx, key, value);
  });
}

function isProposalComparison(result: unknown) {
  const data = asRecord(result);
  return Boolean(data.evaluation_matrix && data.ranking && data.suppliers && data.recommended_supplier);
}

function formatValue(value: unknown, depth = 0): string[] {
  const prefix = depth > 0 ? '  '.repeat(depth) : '';
  if (value === null || value === undefined) return [`${prefix}No especificado`];
  if (Array.isArray(value)) {
    if (!value.length) return [`${prefix}Sin datos`];
    return value.flatMap((item) => (typeof item === 'object' && item !== null ? formatValue(item, depth + 1) : [`${prefix}- ${String(item)}`]));
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
      if (typeof item === 'object' && item !== null) return [`${prefix}${formatLabel(key)}:`, ...formatValue(item, depth + 1)];
      return [`${prefix}${formatLabel(key)}: ${String(item ?? 'No especificado')}`];
    });
  }
  return [`${prefix}${String(value)}`];
}

function addValueBlock(ctx: PdfContext, key: string, value: unknown) {
  if (key === 'charts') {
    const rows = chartRows(value);
    if (rows.length) {
      addTable(
        ctx,
        ['Grafico', 'Tipo', 'Fuente', 'Confianza', 'Datos mostrados', 'Insight'],
        rows.map((row) => [row.chart, row.type, row.source, row.confidence, row.data, row.insight]),
        [28, 20, 24, 20, 55, ctx.maxWidth - 147],
      );
      addText(ctx, 'Los graficos del PDF usan la misma data generada para la plataforma; si no se puede dibujar el grafico exacto, se muestra una tabla equivalente.', {
        size: 8.2,
        color: '#64748b',
      });
      return;
    }
  }
  if (Array.isArray(value) && value.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
    const records = value.map(asRecord);
    const keys = Object.keys(records[0] ?? {});
    if (keys.length > 0 && keys.length <= 5) {
      addTable(ctx, keys.map(formatLabel), records.map((record) => keys.map((item) => record[item])));
      return;
    }
  }
  formatValue(value).forEach((line) => addText(ctx, line, { size: 8.7, color: '#334155' }));
}

function addGenericPdf(input: PdfInput) {
  const ctx = createContext(input);
  addHeader(ctx, input);
  const result = asRecord(input.result);
  const summary = result?.executive_summary ?? result?.summary ?? result?.final_recommendation;
  if (summary) addCard(ctx, 'Resumen ejecutivo', formatValue(summary).slice(0, 5));

  orderedResultEntries(result ?? {}).forEach(([key, value]) => {
    if (['executive_summary', 'summary', 'disclaimer'].includes(key)) return;
    addSection(ctx, formatLabel(key));
    addValueBlock(ctx, key, value);
  });

  addSection(ctx, 'Disclaimer');
  addText(ctx, asText(result.disclaimer, 'Documento generado por Nodus IA como apoyo a decisiones de compra. Validar datos criticos antes de tomar decisiones finales.'), {
    size: 8.5,
    color: '#64748b',
  });
  addFooter(ctx);
  ctx.doc.save(input.fileName ?? 'resultado-nodus-ia.pdf');
}

function getObjective(result: Record<string, unknown>) {
  return asText(result.objective ?? result.description ?? result.executive_summary ?? result.summary ?? result.final_recommendation, '');
}

function getExportSections(result: Record<string, unknown>) {
  return orderedResultEntries(result).filter(([key]) => key !== 'disclaimer');
}

function rowsFromValue(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    if (!value.length) return [];
    if (value.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
      return value.map((item) => {
        const record = asRecord(item);
        const normalized: Record<string, unknown> = {};
        Object.entries(record)
          .filter(([key, itemValue]) => !technicalKeys.has(key) && !isEmptyValue(itemValue))
          .forEach(([key, itemValue]) => {
            normalized[formatLabel(key)] = typeof itemValue === 'object' && itemValue !== null ? asText(itemValue) : itemValue;
          });
        return normalized;
      });
    }
    return value.map((item, index) => ({ N: index + 1, Valor: asText(item) }));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key, itemValue]) => !technicalKeys.has(key) && !isEmptyValue(itemValue))
      .map(([key, itemValue]) => ({
        Campo: formatLabel(key),
        Valor: asText(itemValue),
      }));
  }

  return [{ Valor: asText(value) }];
}

function normalizeSheetName(name: string, used: Set<string>) {
  const clean = name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28).trim() || 'Hoja';
  let candidate = clean;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${clean.slice(0, 25)} ${index}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

function addMetadataSheet(XLSX: XlsxModule, workbook: import('xlsx').WorkBook, input: AgentExportInput, result: Record<string, unknown>) {
  const mode = input.pdfMode ?? 'standard_branded';
  const rows = [
    ['Titulo', input.title],
    ['Fecha de generacion', formatDate()],
    ['Agente usado', input.agentName || input.title],
    ['Usuario o empresa', input.userName || input.pdfOptions?.branding.companyName || 'No especificado'],
    ['Objetivo o descripcion', getObjective(result) || 'No especificado'],
    ['Formato generado', input.format.toUpperCase()],
    ['Marca', getFooterLeft(mode, input.pdfOptions) || 'Sin logo'],
    ['Pie', getFooterRight(mode, input.pdfOptions)],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 28 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, sheet, 'Resumen');
}

async function downloadAgentResultXlsx(input: AgentExportInput) {
  const XLSX = await import('xlsx');
  const result = asRecord(input.result);
  const workbook = XLSX.utils.book_new();
  addMetadataSheet(XLSX, workbook, input, result);
  const used = new Set<string>(['Resumen']);

  getExportSections(result).forEach(([key, value]) => {
    const rows = key === 'charts' ? chartRows(value) : rowsFromValue(value);
    if (!rows.length) return;
    const sheet = XLSX.utils.json_to_sheet(rows);
    const columns = Object.keys(rows[0] ?? {});
    sheet['!cols'] = columns.map((column) => ({
      wch: Math.min(Math.max(column.length + 6, 18), 55),
    }));
    XLSX.utils.book_append_sheet(workbook, sheet, normalizeSheetName(formatLabel(key), used));
  });

  XLSX.writeFile(workbook, getDefaultFileName(input, 'xlsx'));
}

function docxParagraph(docx: DocxModule, text: string, options: { heading?: boolean; bold?: boolean; color?: string } = {}): import('docx').Paragraph {
  return new docx.Paragraph({
    spacing: { after: options.heading ? 180 : 90 },
    children: [
      new docx.TextRun({
        text,
        bold: Boolean(options.bold || options.heading),
        color: options.color ?? (options.heading ? '09008B' : '1F2937'),
        size: options.heading ? 26 : 20,
      }),
    ],
  });
}

function docxTableFromRows(docx: DocxModule, rows: Array<Record<string, unknown>>): import('docx').Table | undefined {
  const keys = Object.keys(rows[0] ?? {}).slice(0, 6);
  if (!keys.length) return undefined;
  return new docx.Table({
    width: { size: 100, type: docx.WidthType.PERCENTAGE },
    rows: [
      new docx.TableRow({
        tableHeader: true,
        children: keys.map((key) => new docx.TableCell({
          shading: { fill: 'EEF2FF' },
          borders: { bottom: { style: docx.BorderStyle.SINGLE, size: 1, color: 'CBD5E1' } },
          children: [docxParagraph(docx, key, { bold: true, color: '09008B' })],
        })),
      }),
      ...rows.slice(0, 80).map((row) => new docx.TableRow({
        children: keys.map((key) => new docx.TableCell({
          children: [docxParagraph(docx, shortText(row[key], 500))],
        })),
      })),
    ],
  });
}

async function downloadAgentResultDocx(input: AgentExportInput) {
  const docx = await import('docx');
  const result = asRecord(input.result);
  const mode = input.pdfMode ?? 'standard_branded';
  const children: DocxChild[] = [
    docxParagraph(docx, input.title, { heading: true }),
    docxParagraph(docx, `Fecha de generacion: ${formatDate()}`),
    docxParagraph(docx, `Agente usado: ${input.agentName || input.title}`),
    docxParagraph(docx, `Usuario o empresa: ${input.userName || input.pdfOptions?.branding.companyName || 'No especificado'}`),
    docxParagraph(docx, `Formato generado: WORD / DOCX`),
  ];
  const objective = getObjective(result);
  if (objective) children.push(docxParagraph(docx, `Objetivo o descripcion: ${objective}`));

  getExportSections(result).forEach(([key, value]) => {
    children.push(docxParagraph(docx, formatLabel(key), { heading: true }));
    const rows = key === 'charts' ? chartRows(value) : rowsFromValue(value);
    const table = docxTableFromRows(docx, rows);
    if (table) {
      children.push(table);
    } else {
      formatValue(value).slice(0, 60).forEach((line) => children.push(docxParagraph(docx, line)));
    }
  });

  if (result.disclaimer) {
    children.push(docxParagraph(docx, 'Disclaimer', { heading: true }));
    children.push(docxParagraph(docx, asText(result.disclaimer)));
  }

  const footerLeft = getFooterLeft(mode, input.pdfOptions);
  const footerRight = getFooterRight(mode, input.pdfOptions);
  const doc = new docx.Document({
    sections: [{
      footers: {
        default: new docx.Footer({
          children: [
            new docx.Paragraph({
              alignment: docx.AlignmentType.LEFT,
              children: [
                new docx.TextRun(footerLeft || ''),
                new docx.TextRun({ text: footerLeft ? '     ' : '' }),
                new docx.TextRun(footerRight),
                new docx.TextRun({ text: '     Pagina ' }),
                new docx.TextRun({ children: [docx.PageNumber.CURRENT] }),
              ],
            }),
          ],
        }),
      },
      children,
    }],
  });
  const blob = await docx.Packer.toBlob(doc);
  downloadBlob(blob, getDefaultFileName(input, 'docx'));
}

function addPptFooter(slide: PptxSlide, input: AgentExportInput) {
  const mode = input.pdfMode ?? 'standard_branded';
  const left = getFooterLeft(mode, input.pdfOptions);
  const right = getFooterRight(mode, input.pdfOptions);
  if (left) slide.addText(left, { x: 0.35, y: 7.12, w: 3.2, h: 0.18, fontSize: 7, color: '64748B' });
  slide.addText(right, { x: 8.9, y: 7.12, w: 3.8, h: 0.18, fontSize: 7, color: '64748B', align: 'right' });
}

function addPptTitle(slide: PptxSlide, title: string, subtitle?: string) {
  slide.background = { color: 'FFFFFF' };
  slide.addText(title, { x: 0.5, y: 0.35, w: 12.3, h: 0.45, fontSize: 23, bold: true, color: '09008B', fit: 'shrink' });
  if (subtitle) slide.addText(subtitle, { x: 0.52, y: 0.9, w: 11.8, h: 0.35, fontSize: 9, color: '64748B', fit: 'shrink' });
}

async function downloadAgentResultPptx(input: AgentExportInput) {
  const result = asRecord(input.result);
  const pptxgen = (await import('pptxgenjs')).default;
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Buyer Nodus';
  pptx.subject = input.agentName || input.title;
  pptx.title = input.title;
  pptx.company = getBrandName(input.pdfMode ?? 'standard_branded', input.pdfOptions) || 'Buyer Nodus';
  pptx.theme = {
    headFontFace: 'Aptos Display',
    bodyFontFace: 'Aptos',
    lang: 'es-PE',
  };

  let slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
  slide.addText(getBrandName(input.pdfMode ?? 'standard_branded', input.pdfOptions) || 'Reporte ejecutivo', { x: 0.55, y: 0.35, w: 6, h: 0.25, fontSize: 9, bold: true, color: '6B63D9' });
  slide.addText(input.title, { x: 0.55, y: 1.05, w: 11.9, h: 1, fontSize: 30, bold: true, color: '09008B', fit: 'shrink' });
  slide.addText(`Agente: ${input.agentName || input.title}\nFecha: ${formatDate()}\nUsuario/empresa: ${input.userName || input.pdfOptions?.branding.companyName || 'No especificado'}\nFormato: POWERPOINT / PPTX`, {
    x: 0.6,
    y: 2.55,
    w: 8.6,
    h: 1.1,
    fontSize: 13,
    color: '334155',
    breakLine: false,
    fit: 'shrink',
  });
  const objective = getObjective(result);
  if (objective) slide.addText(shortText(objective, 420), { x: 0.6, y: 4.1, w: 11.7, h: 1.1, fontSize: 14, color: '1F2937', fit: 'shrink' });
  addPptFooter(slide, input);

  getExportSections(result).slice(0, 18).forEach(([key, value]) => {
    const rows = key === 'charts' ? chartRows(value) : rowsFromValue(value);
    slide = pptx.addSlide();
    addPptTitle(slide, formatLabel(key), 'Misma informacion generada por el agente en la plataforma.');

    if (rows.length && Object.keys(rows[0] ?? {}).length <= 5) {
      const keys = Object.keys(rows[0]).slice(0, 5);
      slide.addTable(
        [
          keys.map((name) => ({ text: name, options: { bold: true, color: '09008B', fill: 'EEF2FF' } })),
          ...rows.slice(0, 8).map((row) => keys.map((name) => ({ text: shortText(row[name], 120), options: { color: '334155' } }))),
        ],
        { x: 0.55, y: 1.35, w: 12.2, h: 5.3, border: { color: 'CBD5E1', pt: 0.5 }, fontSize: 8, valign: 'mid' },
      );
    } else {
      slide.addText(formatValue(value).slice(0, 12).join('\n'), { x: 0.65, y: 1.35, w: 11.8, h: 5.3, fontSize: 13, color: '334155', fit: 'shrink', breakLine: false });
    }
    addPptFooter(slide, input);
  });

  if (result.disclaimer) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Disclaimer');
    slide.addText(asText(result.disclaimer), { x: 0.65, y: 1.35, w: 11.8, h: 3.8, fontSize: 14, color: '334155', fit: 'shrink' });
    addPptFooter(slide, input);
  }

  await pptx.writeFile({ fileName: getDefaultFileName(input, 'pptx') });
}

export function downloadAgentResultPdf(input: PdfInput) {
  if (isProposalComparison(input.result)) {
    addProposalComparisonPdf(input);
    return;
  }
  addGenericPdf(input);
}

export async function downloadAgentResult(input: AgentExportInput) {
  if (input.format === 'pdf') {
    downloadAgentResultPdf({ ...input, fileName: getDefaultFileName(input, 'pdf') });
    return;
  }
  if (input.format === 'docx') {
    await downloadAgentResultDocx(input);
    return;
  }
  if (input.format === 'pptx') {
    await downloadAgentResultPptx(input);
    return;
  }
  await downloadAgentResultXlsx(input);
}
