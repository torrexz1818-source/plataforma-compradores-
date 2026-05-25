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
  captureElementId?: string;
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
  confidence_reason: 'Justificacion de confianza',
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
  'confidence_reason',
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

function normalizeExtractedText(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/(?:\b[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]\s+){4,}[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]\b/g, (match) => match.replace(/\s+/g, ''))
    .trim();
}

function asText(value: unknown, fallback = 'No especificado') {
  if (value === null || value === undefined || value === '') return fallback;
  if (Array.isArray(value)) return value.map((item) => asText(item, '')).filter(Boolean).join(', ') || fallback;
  if (typeof value === 'object') return JSON.stringify(value);
  return normalizeExtractedText(String(value)) || fallback;
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
  doc.text(`Fecha: ${formatDate()}`, ctx.marginX + 6, ctx.y + 23);
  ctx.y += 35;
  if (subtitle) {
    addText(ctx, subtitle, { size: 9, color: '#475569', gap: 2 });
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
  const values = items.map((item) => asText(item, '')).filter(Boolean).slice(0, limit);
  if (!values.length) return;
  addText(ctx, title, { size: 9.2, bold: true, color: '#0f172a' });
  values.forEach((item) => addText(ctx, `- ${item}`, { size: 8.5, color: '#475569' }));
}

function addTable(ctx: PdfContext, headers: string[], rows: unknown[][], widths?: number[]) {
  if (!rows.length) return;
  const { doc } = ctx;
  const colWidths = widths ?? headers.map(() => ctx.maxWidth / headers.length);
  const headerHeight = 9;
  const fontSize = 7.1;
  const lineHeight = 3.7;
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
    const cells = row.map((cell, index) => doc.splitTextToSize(asText(cell, ''), Math.max(colWidths[index] - 3, 8)));
    let offset = 0;
    const maxLines = Math.max(...cells.map((cell) => cell.length), 1);

    while (offset < maxLines) {
      const availableHeight = ctx.pageHeight - 18 - ctx.y;
      const availableLines = Math.max(Math.floor((availableHeight - 3) / lineHeight), 1);
      const linesThisPage = Math.min(maxLines - offset, availableLines);
      const rowHeight = Math.max(9, linesThisPage * lineHeight + 4);

      if (ctx.y + rowHeight > ctx.pageHeight - 16) {
        addFooter(ctx);
        doc.addPage();
        ctx.y = 16;
        drawHeader();
        continue;
      }

      doc.setFillColor(rowIndex % 2 ? '#f8fafc' : '#ffffff');
      doc.setDrawColor('#e2e8f0');
      doc.rect(ctx.marginX, ctx.y, ctx.maxWidth, rowHeight, 'FD');
      let x = ctx.marginX;
      cells.forEach((cell, index) => {
        const visibleLines = cell.slice(offset, offset + linesThisPage);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor('#334155');
        doc.text(visibleLines.length ? visibleLines : [''], x + 1.5, ctx.y + 5);
        x += colWidths[index];
      });
      ctx.y += rowHeight;
      offset += linesThisPage;
    }
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

function isDashboardResult(result: unknown) {
  const data = asRecord(result);
  return Boolean(data.dashboard_title && Array.isArray(data.kpis) && Array.isArray(data.charts) && Array.isArray(data.tables));
}

function isTcoAnalysisResult(result: unknown) {
  const data = asRecord(result);
  return Boolean(data.analysis_title && data.tco_matrix && data.ranking && data.strategic_recommendation);
}

function dashboardTableRows(table: Record<string, unknown>) {
  const columns = asArray(table.columns).map((item) => asText(item, '')).filter(Boolean);
  return asArray(table.rows).map(asRecord).map((row) => {
    const normalized: Record<string, unknown> = {};
    columns.forEach((column) => {
      normalized[column] = row[column] ?? '';
    });
    return normalized;
  });
}

function dashboardChartDataRows(chart: Record<string, unknown>) {
  return asArray(chart.data).map(asRecord).map((point) => ({
    Grafico: chart.title,
    Tipo: chart.type,
    Etiqueta: point.label,
    Valor: point.value,
    Grupo: point.group ?? '',
    Insight: chart.insight ?? '',
  }));
}

function dashboardListRows(items: unknown[], valueKey = 'Valor') {
  return items.map((item, index) => ({ N: index + 1, [valueKey]: asText(item) }));
}

function tcoDetectedAlternativeRows(result: Record<string, unknown>) {
  return asArray(result.detected_alternatives).map(asRecord).map((item) => ({
    Proveedor: item.supplier_name,
    Archivo: item.source_file,
    Precio: item.detected_price,
    Garantia: item.warranty,
    Plazo: item.lead_time,
    Costos: asArray(item.detected_costs).join(', '),
    'Datos faltantes': asArray(item.data_missing).join(', '),
    Confianza: item.confidence_level,
  }));
}

function tcoDataUsedRows(result: Record<string, unknown>) {
  return asArray(result.data_used).map(asRecord).map((item) => ({
    Alternativa: item.alternative,
    'Precio base': item.base_price,
    Cantidad: item.quantity,
    Moneda: item.currency,
    Horizonte: item.horizon,
    Origen: item.origin,
    Destino: item.destination,
    Incoterm: item.incoterm,
    'Lead time': item.lead_time,
    Supuestos: asArray(item.key_assumptions).join(' | '),
  }));
}

function tcoMatrixRows(result: Record<string, unknown>) {
  return asArray(result.tco_matrix).map(asRecord).map((row) => ({
    Componente: row.cost_component,
    ...asRecord(row.values),
    Notas: row.notes,
  }));
}

function tcoRankingRows(result: Record<string, unknown>) {
  return asArray(result.ranking).map(asRecord).map((item) => ({
    Posicion: item.position,
    Alternativa: item.alternative,
    Tipo: item.ranking_type,
    TCO: item.total_tco,
    Motivo: item.reason,
  }));
}

function tcoTotalsRows(result: Record<string, unknown>) {
  return asArray(result.tco_totals).map(asRecord).map((item) => ({
    Alternativa: item.alternative,
    'Precio inicial': item.initial_price,
    'TCO total': item.total_tco,
    'TCO unitario': item.tco_per_unit,
    'TCO mensual': item.tco_monthly,
    'TCO anual': item.tco_annual,
    Riesgo: item.risk_level,
    'Costos ocultos': asArray(item.main_hidden_costs).join(', '),
  }));
}

function tcoRiskRows(result: Record<string, unknown>) {
  return asArray(result.risk_analysis).map(asRecord).map((item) => ({
    Riesgo: item.risk,
    Alternativa: item.alternative,
    Probabilidad: item.probability,
    Impacto: item.economic_impact,
    'Costo esperado': item.expected_risk_cost,
    Nivel: item.level,
    Mitigacion: item.mitigation,
  }));
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
  const subtitle = `Servicio evaluado: ${asText(result.service)} | Objetivo: ${asText(result.objective)}`;

  addHeader(ctx, input, subtitle);
  addCard(ctx, 'Resumen ejecutivo', [
    `Propuestas evaluadas: ${suppliers.length}`,
    `Proveedor recomendado: ${recommendedName}`,
    `Motivo principal: ${asText(recommended.reason || result.executive_summary)}`,
    `Riesgo principal: ${asText(asArray(recommended.main_risks)[0] || asArray(result.global_risks)[0])}`,
  ]);

  addCard(ctx, 'Proveedor recomendado', [
    `${recommendedName}`,
    `Puntaje: ${asText(recommended.weighted_score ?? recommended.score, 'Sin puntaje')} / 5`,
    `Por que gana: ${asText(recommended.reason)}`,
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
  addCard(ctx, 'Alertas principales', asArray(result.global_risks).map((item) => `- ${asText(item)}`).join('\n') || 'Sin riesgos globales registrados.', 'amber');

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

function addDashboardResultPdf(input: PdfInput) {
  const result = asRecord(input.result);
  const ctx = createContext(input);
  const subtitle = `Audiencia: ${asText(result.audience)} | Periodo: ${asText(result.period)} | Confianza: ${asText(result.confidence_level)}`;

  addHeader(ctx, input, subtitle);
  addCard(ctx, 'Resumen ejecutivo', [
    asText(result.executive_summary),
    `Tipo de datos: ${asText(result.data_type)}`,
    `Confianza: ${asText(result.confidence_level)} - ${asText(result.confidence_reason)}`,
  ]);

  const kpis = asArray(result.kpis).map(asRecord);
  if (kpis.length) {
    addSection(ctx, 'KPIs principales');
    addTable(
      ctx,
      ['KPI', 'Valor', 'Descripcion', 'Fuente', 'Confianza'],
      kpis.map((kpi) => [kpi.title, kpi.value, kpi.description, kpi.source, kpi.confidence]),
      [36, 27, 58, 32, ctx.maxWidth - 153],
    );
  }

  const charts = asArray(result.charts).map(asRecord);
  if (charts.length) {
    addSection(ctx, 'Graficos y datos base');
    addTable(
      ctx,
      ['Grafico', 'Tipo', 'Datos mostrados', 'Insight'],
      chartRows(charts).map((row) => [row.chart, row.type, row.data, row.insight]),
      [38, 24, 62, ctx.maxWidth - 124],
    );
    addText(ctx, 'Los graficos se documentan con la misma data generada por el agente para que el reporte sea editable y auditable.', {
      size: 8.2,
      color: '#64748b',
    });
  }

  const tables = asArray(result.tables).map(asRecord);
  if (tables.length) {
    addSection(ctx, 'Tablas del dashboard');
    tables.slice(0, 6).forEach((table) => {
      addText(ctx, asText(table.title, 'Tabla resumen'), { size: 9.5, bold: true, color: '#0f172a' });
      if (table.description) addText(ctx, asText(table.description), { size: 8.5, color: '#64748b' });
      const rows = dashboardTableRows(table);
      const keys = Object.keys(rows[0] ?? {}).slice(0, 5);
      if (keys.length) {
        addTable(
          ctx,
          keys,
          rows.slice(0, 10).map((row) => keys.map((key) => row[key])),
          keys.map(() => ctx.maxWidth / keys.length),
        );
      }
    });
  }

  const insights = asArray(result.insights).map(asRecord);
  if (insights.length) {
    addSection(ctx, 'Insights accionables');
    addTable(
      ctx,
      ['Insight', 'Descripcion', 'Impacto', 'Accion sugerida'],
      insights.map((item) => [item.title, item.description, item.impact, item.recommended_action]),
      [38, 58, 26, ctx.maxWidth - 122],
    );
  }

  const observations = asArray(result.observations).map(asRecord);
  if (observations.length) {
    addSection(ctx, 'Observaciones');
    addTable(
      ctx,
      ['Observacion', 'Tipo', 'Descripcion'],
      observations.map((item) => [item.title, item.type, item.description]),
      [48, 28, ctx.maxWidth - 76],
    );
  }

  addSection(ctx, 'Recomendaciones');
  addBulletList(ctx, 'Acciones sugeridas', asArray(result.recommendations), 8);
  addBulletList(ctx, 'Informacion faltante', asArray(result.missing_information), 8);

  const dataProfile = asRecord(result.data_profile);
  const qualityWarnings = asArray(dataProfile.data_quality_warnings);
  if (qualityWarnings.length || result.data_understanding || result.extracted_data_quality) {
    addSection(ctx, 'Calidad de datos');
    if (result.data_understanding) addText(ctx, asText(result.data_understanding), { size: 8.7, color: '#334155' });
    if (result.extracted_data_quality) addValueBlock(ctx, 'extracted_data_quality', result.extracted_data_quality);
    addBulletList(ctx, 'Advertencias de calidad', qualityWarnings, 8);
  }

  const sourceFiles = asArray(result.source_files).map(asRecord);
  if (sourceFiles.length) {
    addSection(ctx, 'Archivos procesados');
    addTable(
      ctx,
      ['Archivo', 'Tipo', 'Filas', 'Columnas', 'Estado'],
      sourceFiles.map((item) => [item.file_name ?? item.name, item.detected_type ?? item.type, item.rows, item.columns, item.status ?? item.confidence]),
      [48, 26, 22, 24, ctx.maxWidth - 120],
    );
  }

  addAdditionalResultSections(ctx, result, [
    'dashboard_title',
    'audience',
    'period',
    'data_type',
    'confidence_level',
    'confidence_reason',
    'executive_summary',
    'kpis',
    'charts',
    'tables',
    'insights',
    'observations',
    'recommendations',
    'missing_information',
    'data_profile',
    'data_understanding',
    'extracted_data_quality',
    'source_files',
    'disclaimer',
  ]);

  addSection(ctx, 'Disclaimer');
  addText(ctx, asText(result.disclaimer, 'Dashboard generado por Nodus IA como apoyo ejecutivo. Validar los datos fuente antes de tomar decisiones finales.'), {
    size: 8.5,
    color: '#64748b',
  });
  addFooter(ctx);
  ctx.doc.save(input.fileName ?? 'dashboard-nodus-ia.pdf');
}

function addTcoAnalysisPdf(input: PdfInput) {
  const result = asRecord(input.result);
  const ctx = createContext(input);
  const summary = asRecord(result.executive_summary);
  const recommendation = asRecord(result.strategic_recommendation);
  const subtitle = `Producto/servicio: ${asText(result.item_name)} | Horizonte: ${asText(result.evaluation_horizon)} | Moneda: ${asText(result.currency)}`;

  addHeader(ctx, input, subtitle);
  addCard(ctx, 'Resumen ejecutivo', [
    `Mejor alternativa preliminar: ${asText(summary.best_alternative)}`,
    `Motivo: ${asText(summary.why_it_wins)}`,
    `Ahorro o sobrecosto: ${asText(summary.estimated_saving_or_overcost)}`,
    `Riesgo principal: ${asText(summary.main_risk)}`,
    `Recomendacion final: ${asText(summary.final_recommendation)}`,
  ], 'green');

  const documents = asArray(result.supporting_documents_summary).map(asRecord);
  if (documents.length) {
    addSection(ctx, 'Resumen de documentos procesados');
    addTable(
      ctx,
      ['Archivo', 'Tipo detectado', 'Hallazgos relevantes', 'Limitaciones'],
      documents.map((item) => [
        item.file_name ?? item.name,
        item.detected_type ?? item.type,
        asArray(item.relevant_findings).map((finding) => asText(finding, '')).join('\n'),
        asArray(item.limitations).map((limitation) => asText(limitation, '')).join('\n'),
      ]),
      [38, 24, 78, ctx.maxWidth - 140],
    );
  }

  const alternatives = tcoDetectedAlternativeRows(result);
  if (alternatives.length) {
    addSection(ctx, 'Alternativas detectadas');
    addTable(
      ctx,
      ['Proveedor', 'Archivo', 'Precio', 'Garantia', 'Plazo', 'Datos faltantes'],
      alternatives.map((item) => [item.Proveedor, item.Archivo, item.Precio, item.Garantia, item.Plazo, item['Datos faltantes']]),
      [34, 42, 24, 28, 24, ctx.maxWidth - 152],
    );
  }

  const dataUsed = tcoDataUsedRows(result);
  if (dataUsed.length) {
    addSection(ctx, 'Datos usados por alternativa');
    addTable(
      ctx,
      ['Alternativa', 'Precio base', 'Cantidad', 'Moneda', 'Horizonte', 'Supuestos'],
      dataUsed.map((item) => [item.Alternativa, item['Precio base'], item.Cantidad, item.Moneda, item.Horizonte, item.Supuestos]),
      [36, 26, 20, 20, 26, ctx.maxWidth - 128],
    );
  }

  const matrix = tcoMatrixRows(result);
  if (matrix.length) {
    addSection(ctx, 'Matriz TCO comparativa');
    const keys = Object.keys(matrix[0] ?? {}).slice(0, 6);
    addTable(ctx, keys, matrix.map((row) => keys.map((key) => row[key])), keys.map(() => ctx.maxWidth / keys.length));
  }

  const totals = tcoTotalsRows(result);
  if (totals.length) {
    addSection(ctx, 'Totales TCO');
    addTable(
      ctx,
      ['Alternativa', 'Precio inicial', 'TCO total', 'TCO unitario', 'Riesgo', 'Costos ocultos'],
      totals.map((item) => [item.Alternativa, item['Precio inicial'], item['TCO total'], item['TCO unitario'], item.Riesgo, item['Costos ocultos']]),
      [34, 25, 25, 25, 22, ctx.maxWidth - 131],
    );
  }

  const ranking = tcoRankingRows(result);
  if (ranking.length) {
    addSection(ctx, 'Ranking comparativo');
    addTable(
      ctx,
      ['Posicion', 'Alternativa', 'Tipo', 'TCO', 'Motivo'],
      ranking.map((item) => [item.Posicion, item.Alternativa, item.Tipo, item.TCO, item.Motivo]),
      [18, 38, 26, 28, ctx.maxWidth - 110],
    );
  }

  const risks = tcoRiskRows(result);
  if (risks.length) {
    addSection(ctx, 'Analisis de riesgos');
    addTable(
      ctx,
      ['Riesgo', 'Alternativa', 'Probabilidad', 'Impacto', 'Nivel', 'Mitigacion'],
      risks.map((item) => [item.Riesgo, item.Alternativa, item.Probabilidad, item.Impacto, item.Nivel, item.Mitigacion]),
      [34, 30, 24, 30, 20, ctx.maxWidth - 138],
    );
  }

  if (result.interpretation) {
    addSection(ctx, 'Interpretacion');
    addValueBlock(ctx, 'interpretation', result.interpretation);
  }

  if (result.sensitivity_analysis) {
    addSection(ctx, 'Analisis de sensibilidad');
    addValueBlock(ctx, 'sensitivity_analysis', result.sensitivity_analysis);
  }

  addSection(ctx, 'Recomendacion estrategica');
  addTable(
    ctx,
    ['Campo', 'Detalle'],
    Object.entries(recommendation).map(([key, value]) => [formatLabel(key), asText(value)]),
    [50, ctx.maxWidth - 50],
  );

  addSection(ctx, 'Validaciones pendientes');
  addBulletList(ctx, 'Informacion faltante', asArray(result.missing_information), 20);
  addBulletList(ctx, 'Preguntas para usuario o proveedores', asArray(result.questions_for_user_or_suppliers), 20);
  addBulletList(ctx, 'Supuestos y limites', asArray(result.assumptions_and_limits), 20);
  addBulletList(ctx, 'Advertencias de calculo', asArray(result.calculation_warnings), 20);

  addAdditionalResultSections(ctx, result, [
    'analysis_title',
    'item_name',
    'evaluation_horizon',
    'currency',
    'executive_summary',
    'supporting_documents_summary',
    'detected_alternatives',
    'data_used',
    'tco_matrix',
    'tco_totals',
    'ranking',
    'risk_analysis',
    'interpretation',
    'sensitivity_analysis',
    'strategic_recommendation',
    'missing_information',
    'questions_for_user_or_suppliers',
    'assumptions_and_limits',
    'calculation_warnings',
    'disclaimer',
  ]);

  addSection(ctx, 'Disclaimer');
  addText(ctx, asText(result.disclaimer, 'Analisis generado por Nodus IA como apoyo a decisiones de compra. Validar datos criticos antes de tomar decisiones finales.'), {
    size: 8.5,
    color: '#64748b',
  });
  addFooter(ctx);
  ctx.doc.save(input.fileName ?? 'analisis-tco-nodus-ia.pdf');
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

function isTermsOfReferenceResult(result: unknown) {
  const data = asRecord(result);
  return Boolean(data.generated_document && data.tender_bases && data.supplier_invitation_email && data.tender_process);
}

function getTermsDocument(result: Record<string, unknown>) {
  return asRecord(result.generated_document);
}

function getTermsGeneralData(result: Record<string, unknown>) {
  return asRecord(getTermsDocument(result).general_data);
}

function getTermsTenderBases(result: Record<string, unknown>) {
  return asRecord(result.tender_bases);
}

function getTermsEmail(result: Record<string, unknown>) {
  return asRecord(result.supplier_invitation_email);
}

function termsListRows(items: unknown[], label = 'Detalle') {
  return items.map((item, index) => ({ N: index + 1, [label]: asText(item) }));
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
  if (summary) addCard(ctx, 'Resumen ejecutivo', formatValue(summary));

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

async function addCapturedDashboardPdf(input: PdfInput) {
  if (!input.captureElementId) return false;
  const element = document.getElementById(input.captureElementId);
  if (!element) return false;

  const { default: html2canvas } = await import('html2canvas');
  const hiddenElements = Array.from(element.querySelectorAll<HTMLElement>('[data-export-hidden="true"]'));
  hiddenElements.forEach((item) => {
    item.dataset.previousDisplay = item.style.display;
    item.style.display = 'none';
  });

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: Math.min(window.devicePixelRatio || 2, 2),
      useCORS: true,
      logging: false,
    });
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 8;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/png');

    let position = margin;
    let remainingHeight = imgHeight;
    doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
    remainingHeight -= pageHeight - margin * 2;

    while (remainingHeight > 0) {
      doc.addPage();
      position = margin - (imgHeight - remainingHeight);
      doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight, undefined, 'FAST');
      remainingHeight -= pageHeight - margin * 2;
    }

    doc.save(input.fileName ?? 'dashboard-nodus-ia.pdf');
    return true;
  } finally {
    hiddenElements.forEach((item) => {
      item.style.display = item.dataset.previousDisplay || '';
      delete item.dataset.previousDisplay;
    });
  }
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
  const rows = [
    ['Titulo', input.title],
    ['Fecha de generacion', formatDate()],
    ['Agente', input.agentName || input.title],
    ['Objetivo o descripcion', getObjective(result) || 'No especificado'],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 28 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(workbook, sheet, 'Resumen');
}

function appendJsonSheet(
  XLSX: XlsxModule,
  workbook: import('xlsx').WorkBook,
  used: Set<string>,
  name: string,
  rows: Array<Record<string, unknown>>,
) {
  if (!rows.length) return;
  const sheet = XLSX.utils.json_to_sheet(rows);
  const columns = Object.keys(rows[0] ?? {});
  sheet['!cols'] = columns.map((column) => ({ wch: Math.min(Math.max(column.length + 8, 18), 60) }));
  XLSX.utils.book_append_sheet(workbook, sheet, normalizeSheetName(name, used));
}

async function downloadDashboardResultXlsx(input: AgentExportInput, result: Record<string, unknown>) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  addMetadataSheet(XLSX, workbook, input, result);
  const used = new Set<string>(['Resumen']);

  appendJsonSheet(XLSX, workbook, used, 'KPIs', asArray(result.kpis).map(asRecord).map((kpi) => ({
    KPI: kpi.title,
    Valor: kpi.value,
    Descripcion: kpi.description,
    Logica: kpi.calculation_logic,
    Fuente: kpi.source,
    Confianza: kpi.confidence,
  })));

  appendJsonSheet(XLSX, workbook, used, 'Graficos data', asArray(result.charts).map(asRecord).flatMap(dashboardChartDataRows));

  asArray(result.tables).map(asRecord).forEach((table) => {
    appendJsonSheet(XLSX, workbook, used, asText(table.title, 'Tabla'), dashboardTableRows(table));
  });

  appendJsonSheet(XLSX, workbook, used, 'Insights', asArray(result.insights).map(asRecord).map((item) => ({
    Insight: item.title,
    Descripcion: item.description,
    Impacto: item.impact,
    Accion: item.recommended_action,
  })));
  appendJsonSheet(XLSX, workbook, used, 'Observaciones', asArray(result.observations).map(asRecord).map((item) => ({
    Observacion: item.title,
    Tipo: item.type,
    Descripcion: item.description,
  })));
  appendJsonSheet(XLSX, workbook, used, 'Recomendaciones', dashboardListRows(asArray(result.recommendations), 'Recomendacion'));
  appendJsonSheet(XLSX, workbook, used, 'Info faltante', dashboardListRows(asArray(result.missing_information), 'Informacion faltante'));
  appendJsonSheet(XLSX, workbook, used, 'Calidad datos', dashboardListRows(asArray(asRecord(result.data_profile).data_quality_warnings), 'Advertencia'));
  appendJsonSheet(XLSX, workbook, used, 'Archivos', asArray(result.source_files).map(asRecord));

  XLSX.writeFile(workbook, getDefaultFileName(input, 'xlsx'));
}

async function downloadAgentResultXlsx(input: AgentExportInput) {
  const XLSX = await import('xlsx');
  const result = asRecord(input.result);
  if (isDashboardResult(result)) {
    await downloadDashboardResultXlsx(input, result);
    return;
  }
  if (isTcoAnalysisResult(result)) {
    const workbook = XLSX.utils.book_new();
    addMetadataSheet(XLSX, workbook, input, result);
    const used = new Set<string>(['Resumen']);
    appendJsonSheet(XLSX, workbook, used, 'Alternativas', tcoDetectedAlternativeRows(result));
    appendJsonSheet(XLSX, workbook, used, 'Datos usados', tcoDataUsedRows(result));
    appendJsonSheet(XLSX, workbook, used, 'Matriz TCO', tcoMatrixRows(result));
    appendJsonSheet(XLSX, workbook, used, 'Totales TCO', tcoTotalsRows(result));
    appendJsonSheet(XLSX, workbook, used, 'Ranking', tcoRankingRows(result));
    appendJsonSheet(XLSX, workbook, used, 'Costos ocultos', dashboardListRows(asArray(result.hidden_costs_detected), 'Costo oculto'));
    appendJsonSheet(XLSX, workbook, used, 'Riesgos', tcoRiskRows(result));
    appendJsonSheet(XLSX, workbook, used, 'Info faltante', dashboardListRows(asArray(result.missing_information), 'Informacion faltante'));
    appendJsonSheet(XLSX, workbook, used, 'Preguntas', dashboardListRows(asArray(result.questions_for_user_or_suppliers), 'Pregunta'));
    appendJsonSheet(XLSX, workbook, used, 'Supuestos limites', dashboardListRows(asArray(result.assumptions_and_limits), 'Supuesto o limite'));
    XLSX.writeFile(workbook, getDefaultFileName(input, 'xlsx'));
    return;
  }
  if (isTermsOfReferenceResult(result)) {
    const workbook = XLSX.utils.book_new();
    addMetadataSheet(XLSX, workbook, input, result);
    const used = new Set<string>(['Resumen']);
    const document = getTermsDocument(result);
    const general = getTermsGeneralData(result);
    const bases = getTermsTenderBases(result);
    const email = getTermsEmail(result);

    appendJsonSheet(XLSX, workbook, used, 'Metricas', asArray(result.dashboard_metrics).map(asRecord));
    appendJsonSheet(XLSX, workbook, used, 'Checklist', asArray(result.checklist).map(asRecord).map((item) => ({
      Punto: item.label,
      Estado: item.status,
      Detalle: item.detail,
    })));
    appendJsonSheet(XLSX, workbook, used, 'Datos generales', Object.entries(general).map(([key, value]) => ({ Campo: formatLabel(key), Valor: asText(value) })));
    appendJsonSheet(XLSX, workbook, used, 'Documento TdR', [
      { Seccion: 'Objetivo', Contenido: document.objective },
      { Seccion: 'Alcance', Contenido: document.scope },
      { Seccion: 'Justificacion', Contenido: document.justification },
      { Seccion: 'Caracteristicas tecnicas', Contenido: asArray(document.technical_characteristics).map(asText).join('\n') },
      { Seccion: 'Actividades requeridas', Contenido: asArray(document.required_activities).map(asText).join('\n') },
      { Seccion: 'Entregables', Contenido: asArray(document.final_deliverables).map(asText).join('\n') },
      { Seccion: 'Requisitos de seguridad', Contenido: asArray(document.safety_requirements).map(asText).join('\n') },
      { Seccion: 'Condiciones para proveedores', Contenido: asArray(document.supplier_conditions).map(asText).join('\n') },
      { Seccion: 'Estructura informe final', Contenido: asArray(document.final_report_structure).map(asText).join('\n') },
      { Seccion: 'Anexos sugeridos', Contenido: asArray(document.suggested_annexes).map(asText).join('\n') },
    ]);
    appendJsonSheet(XLSX, workbook, used, 'Bases licitacion', [
      { Seccion: 'Objeto', Contenido: bases.object },
      { Seccion: 'Alcance', Contenido: bases.scope },
      { Seccion: 'Requisitos proveedor', Contenido: asArray(bases.minimum_supplier_requirements).map(asText).join('\n') },
      { Seccion: 'Documentacion solicitada', Contenido: asArray(bases.requested_documentation).map(asText).join('\n') },
      { Seccion: 'Criterios evaluacion', Contenido: asArray(bases.evaluation_criteria).map(asText).join('\n') },
      { Seccion: 'Condiciones presentacion', Contenido: asArray(bases.proposal_submission_conditions).map(asText).join('\n') },
      { Seccion: 'Plazo consultas', Contenido: bases.question_deadline },
      { Seccion: 'Fecha limite propuestas', Contenido: bases.proposal_deadline },
      { Seccion: 'Forma de envio', Contenido: bases.submission_method },
      { Seccion: 'Criterios adjudicacion', Contenido: asArray(bases.award_criteria).map(asText).join('\n') },
      { Seccion: 'Descalificacion', Contenido: asArray(bases.disqualification_conditions).map(asText).join('\n') },
      { Seccion: 'Observaciones comprador', Contenido: asArray(bases.buyer_observations).map(asText).join('\n') },
      { Seccion: 'Advertencia', Contenido: bases.disclaimer },
    ]);
    appendJsonSheet(XLSX, workbook, used, 'Correo proveedores', [
      { Campo: 'Asunto', Valor: email.subject },
      { Campo: 'Saludo', Valor: email.greeting },
      { Campo: 'Cuerpo', Valor: email.body },
      { Campo: 'Adjuntos', Valor: asArray(email.attached_documents).map(asText).join('\n') },
      { Campo: 'Plazo respuesta', Valor: email.response_deadline },
      { Campo: 'Contacto', Valor: email.contact_details },
      { Campo: 'Cierre', Valor: email.closing },
    ]);
    appendJsonSheet(XLSX, workbook, used, 'Proceso licitacion', termsListRows(asArray(result.tender_process), 'Paso'));
    appendJsonSheet(XLSX, workbook, used, 'Info faltante', termsListRows(asArray(result.missing_information), 'Informacion faltante'));
    appendJsonSheet(XLSX, workbook, used, 'Recomendaciones', termsListRows(asArray(result.buyer_recommendations), 'Recomendacion'));
    appendJsonSheet(XLSX, workbook, used, 'Documentos apoyo', asArray(result.supporting_documents_summary).map(asRecord));
    XLSX.writeFile(workbook, getDefaultFileName(input, 'xlsx'));
    return;
  }
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
      ...rows.map((row) => new docx.TableRow({
        children: keys.map((key) => new docx.TableCell({
          children: [docxParagraph(docx, asText(row[key]))],
        })),
      })),
    ],
  });
}

function pushDocxList(docx: DocxModule, children: DocxChild[], title: string, items: unknown[]) {
  children.push(docxParagraph(docx, title, { heading: true }));
  const values = items.length ? items : ['No especificado'];
  values.forEach((item) => children.push(docxParagraph(docx, `- ${asText(item)}`)));
}

async function downloadTermsOfReferenceDocx(input: AgentExportInput, result: Record<string, unknown>) {
  const docx = await import('docx');
  const document = getTermsDocument(result);
  const general = getTermsGeneralData(result);
  const bases = getTermsTenderBases(result);
  const email = getTermsEmail(result);
  const children: DocxChild[] = [
    docxParagraph(docx, asText(result.title, input.title), { heading: true }),
    docxParagraph(docx, `Informe ejecutivo editable | Fecha: ${formatDate()}`),
    docxParagraph(docx, `Agente: ${input.agentName || input.title}`),
    docxParagraph(docx, 'Resumen ejecutivo', { heading: true }),
    docxParagraph(docx, asText(result.executive_summary)),
  ];

  const summaryTable = docxTableFromRows(docx, [
    { Campo: 'Tipo', Valor: result.requirement_type },
    { Campo: 'Categoria', Valor: result.category },
    { Campo: 'Completitud', Valor: `${asText(result.completion_level)} (${asText(result.completion_score)}%)` },
    { Campo: 'Riesgo', Valor: result.risk_level },
    { Campo: 'Ubicacion', Valor: general.location },
    { Campo: 'Fecha requerida', Valor: general.required_date },
  ]);
  if (summaryTable) children.push(summaryTable);

  children.push(docxParagraph(docx, 'Termino de referencia', { heading: true }));
  children.push(docxParagraph(docx, `Objetivo: ${asText(document.objective)}`));
  children.push(docxParagraph(docx, `Alcance: ${asText(document.scope)}`));
  children.push(docxParagraph(docx, `Justificacion: ${asText(document.justification)}`));
  pushDocxList(docx, children, 'Caracteristicas tecnicas', asArray(document.technical_characteristics));
  pushDocxList(docx, children, 'Actividades requeridas', asArray(document.required_activities));
  pushDocxList(docx, children, 'Entregables', asArray(document.final_deliverables));
  pushDocxList(docx, children, 'Requisitos de seguridad', asArray(document.safety_requirements));
  pushDocxList(docx, children, 'Condiciones para proveedores', asArray(document.supplier_conditions));
  pushDocxList(docx, children, 'Anexos sugeridos', asArray(document.suggested_annexes));

  children.push(docxParagraph(docx, 'Checklist de calidad', { heading: true }));
  const checklistTable = docxTableFromRows(docx, asArray(result.checklist).map(asRecord).map((item) => ({
    Punto: item.label,
    Estado: item.status,
    Detalle: item.detail,
  })));
  if (checklistTable) children.push(checklistTable);

  children.push(docxParagraph(docx, 'Bases sugeridas para licitacion', { heading: true }));
  children.push(docxParagraph(docx, `Objeto: ${asText(bases.object)}`));
  children.push(docxParagraph(docx, `Alcance: ${asText(bases.scope)}`));
  pushDocxList(docx, children, 'Requisitos minimos del proveedor', asArray(bases.minimum_supplier_requirements));
  pushDocxList(docx, children, 'Documentacion solicitada', asArray(bases.requested_documentation));
  pushDocxList(docx, children, 'Criterios de evaluacion', asArray(bases.evaluation_criteria));
  pushDocxList(docx, children, 'Condiciones de presentacion de propuestas', asArray(bases.proposal_submission_conditions));
  pushDocxList(docx, children, 'Criterios de adjudicacion', asArray(bases.award_criteria));
  pushDocxList(docx, children, 'Condiciones de descalificacion', asArray(bases.disqualification_conditions));
  children.push(docxParagraph(docx, asText(bases.disclaimer)));

  children.push(docxParagraph(docx, 'Correo sugerido para invitar proveedores', { heading: true }));
  children.push(docxParagraph(docx, `Asunto: ${asText(email.subject)}`));
  children.push(docxParagraph(docx, asText(email.greeting)));
  children.push(docxParagraph(docx, asText(email.body)));
  children.push(docxParagraph(docx, `Adjuntos: ${asArray(email.attached_documents).map(asText).join(', ') || 'No especificado'}`));
  children.push(docxParagraph(docx, `Plazo de respuesta: ${asText(email.response_deadline)}`));
  children.push(docxParagraph(docx, `Contacto: ${asText(email.contact_details)}`));
  children.push(docxParagraph(docx, asText(email.closing)));

  pushDocxList(docx, children, 'Proceso sugerido de licitacion', asArray(result.tender_process));
  pushDocxList(docx, children, 'Informacion faltante', asArray(result.missing_information));
  pushDocxList(docx, children, 'Recomendaciones accionables', asArray(result.buyer_recommendations));
  children.push(docxParagraph(docx, 'Disclaimer', { heading: true }));
  children.push(docxParagraph(docx, asText(result.disclaimer)));

  const doc = new docx.Document({ sections: [{ children }] });
  const blob = await docx.Packer.toBlob(doc);
  downloadBlob(blob, getDefaultFileName(input, 'docx'));
}

async function downloadTcoResultDocx(input: AgentExportInput, result: Record<string, unknown>) {
  const docx = await import('docx');
  const summary = asRecord(result.executive_summary);
  const recommendation = asRecord(result.strategic_recommendation);
  const children: DocxChild[] = [
    docxParagraph(docx, asText(result.analysis_title, input.title), { heading: true }),
    docxParagraph(docx, `Informe ejecutivo editable | Fecha: ${formatDate()}`),
    docxParagraph(docx, `Agente: ${input.agentName || input.title}`),
    docxParagraph(docx, `Producto o servicio: ${asText(result.item_name)} | Horizonte: ${asText(result.evaluation_horizon)} | Moneda: ${asText(result.currency)}`),
    docxParagraph(docx, 'Resumen ejecutivo', { heading: true }),
    docxParagraph(docx, `Mejor alternativa preliminar: ${asText(summary.best_alternative)}`),
    docxParagraph(docx, `Motivo: ${asText(summary.why_it_wins)}`),
    docxParagraph(docx, `Ahorro o sobrecosto: ${asText(summary.estimated_saving_or_overcost)}`),
    docxParagraph(docx, `Riesgo principal: ${asText(summary.main_risk)}`),
    docxParagraph(docx, `Recomendacion final: ${asText(summary.final_recommendation)}`),
  ];

  [
    ['Alternativas detectadas', tcoDetectedAlternativeRows(result)],
    ['Datos usados', tcoDataUsedRows(result)],
    ['Matriz TCO', tcoMatrixRows(result)],
    ['Totales TCO', tcoTotalsRows(result)],
    ['Ranking', tcoRankingRows(result)],
    ['Riesgos', tcoRiskRows(result)],
  ].forEach(([title, rows]) => {
    children.push(docxParagraph(docx, String(title), { heading: true }));
    const table = docxTableFromRows(docx, rows as Array<Record<string, unknown>>);
    if (table) children.push(table);
  });

  pushDocxList(docx, children, 'Costos ocultos detectados', asArray(result.hidden_costs_detected));
  children.push(docxParagraph(docx, 'Analisis de sensibilidad', { heading: true }));
  formatValue(result.sensitivity_analysis).slice(0, 40).forEach((line) => children.push(docxParagraph(docx, line)));
  children.push(docxParagraph(docx, 'Recomendacion estrategica', { heading: true }));
  children.push(docxParagraph(docx, `Accion recomendada: ${asText(recommendation.recommended_action)}`));
  pushDocxList(docx, children, 'Puntos de negociacion', asArray(recommendation.negotiation_points));
  pushDocxList(docx, children, 'Siguientes pasos', asArray(recommendation.next_steps));
  pushDocxList(docx, children, 'Informacion faltante', asArray(result.missing_information));
  pushDocxList(docx, children, 'Preguntas sugeridas para proveedores', asArray(result.questions_for_user_or_suppliers));
  pushDocxList(docx, children, 'Supuestos y limites', asArray(result.assumptions_and_limits));
  children.push(docxParagraph(docx, 'Disclaimer', { heading: true }));
  children.push(docxParagraph(docx, asText(result.disclaimer)));

  const doc = new docx.Document({ sections: [{ children }] });
  const blob = await docx.Packer.toBlob(doc);
  downloadBlob(blob, getDefaultFileName(input, 'docx'));
}

async function downloadAgentResultDocx(input: AgentExportInput) {
  const docx = await import('docx');
  const result = asRecord(input.result);
  const mode = input.pdfMode ?? 'standard_branded';
  if (isTermsOfReferenceResult(result)) {
    await downloadTermsOfReferenceDocx(input, result);
    return;
  }
  if (isTcoAnalysisResult(result)) {
    await downloadTcoResultDocx(input, result);
    return;
  }
  if (isDashboardResult(result)) {
    const children: DocxChild[] = [
      docxParagraph(docx, asText(result.dashboard_title, input.title), { heading: true }),
      docxParagraph(docx, `Fecha de generacion: ${formatDate()}`),
      docxParagraph(docx, `Agente usado: ${input.agentName || input.title}`),
      docxParagraph(docx, `Audiencia: ${asText(result.audience)} | Periodo: ${asText(result.period)} | Tipo de datos: ${asText(result.data_type)}`),
      docxParagraph(docx, 'Resumen ejecutivo', { heading: true }),
      docxParagraph(docx, asText(result.executive_summary)),
      docxParagraph(docx, 'Nivel de confianza', { heading: true }),
      docxParagraph(docx, `${asText(result.confidence_level).toUpperCase()}: ${asText(result.confidence_reason)}`),
      docxParagraph(docx, 'KPIs principales', { heading: true }),
    ];

    const kpiTable = docxTableFromRows(docx, asArray(result.kpis).map(asRecord).map((kpi) => ({
      KPI: kpi.title,
      Valor: kpi.value,
      Descripcion: kpi.description,
      Confianza: kpi.confidence,
    })));
    if (kpiTable) children.push(kpiTable);

    children.push(docxParagraph(docx, 'Graficos generados', { heading: true }));
    const chartTable = docxTableFromRows(docx, chartRows(result.charts));
    if (chartTable) children.push(chartTable);

    asArray(result.tables).map(asRecord).forEach((table) => {
      children.push(docxParagraph(docx, asText(table.title, 'Tabla resumen'), { heading: true }));
      if (table.description) children.push(docxParagraph(docx, asText(table.description)));
      const nativeTable = docxTableFromRows(docx, dashboardTableRows(table));
      if (nativeTable) children.push(nativeTable);
    });

    children.push(docxParagraph(docx, 'Observaciones', { heading: true }));
    const observationTable = docxTableFromRows(docx, asArray(result.observations).map(asRecord).map((item) => ({
      Observacion: item.title,
      Tipo: item.type,
      Descripcion: item.description,
    })));
    if (observationTable) children.push(observationTable);

    children.push(docxParagraph(docx, 'Insights y recomendaciones', { heading: true }));
    asArray(result.insights).map(asRecord).forEach((item) => {
      children.push(docxParagraph(docx, `${asText(item.title)}: ${asText(item.description)} Accion: ${asText(item.recommended_action)}`));
    });
    asArray(result.recommendations).forEach((item) => children.push(docxParagraph(docx, `- ${asText(item)}`)));

    children.push(docxParagraph(docx, 'Informacion faltante y calidad de datos', { heading: true }));
    [...asArray(result.missing_information), ...asArray(asRecord(result.data_profile).data_quality_warnings)]
      .forEach((item) => children.push(docxParagraph(docx, `- ${asText(item)}`)));

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
    return;
  }
  const children: DocxChild[] = [
    docxParagraph(docx, input.title, { heading: true }),
    docxParagraph(docx, `Fecha de generacion: ${formatDate()}`),
    docxParagraph(docx, `Agente: ${input.agentName || input.title}`),
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

function addPptRows(slide: PptxSlide, rows: Array<Record<string, unknown>>, options: { x?: number; y?: number; w?: number; h?: number; maxRows?: number } = {}) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]).slice(0, 5);
  slide.addTable(
    [
      keys.map((name) => ({ text: name, options: { bold: true, color: '09008B', fill: 'EEF2FF' } })),
      ...rows.slice(0, options.maxRows ?? 12).map((row) => keys.map((name) => ({ text: asText(row[name]), options: { color: '334155' } }))),
    ],
    {
      x: options.x ?? 0.55,
      y: options.y ?? 1.35,
      w: options.w ?? 12.2,
      h: options.h ?? 5.3,
      border: { color: 'CBD5E1', pt: 0.5 },
      fontSize: 8,
      valign: 'mid',
    },
  );
}

async function downloadTermsOfReferencePptx(input: AgentExportInput, result: Record<string, unknown>) {
  const pptxgen = (await import('pptxgenjs')).default;
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Buyer Nodus';
  pptx.subject = input.agentName || input.title;
  pptx.title = asText(result.title, input.title);
  pptx.company = getBrandName(input.pdfMode ?? 'standard_branded', input.pdfOptions) || 'Buyer Nodus';
  pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'es-PE' };

  const document = getTermsDocument(result);
  const bases = getTermsTenderBases(result);
  const email = getTermsEmail(result);
  let slide = pptx.addSlide();
  addPptTitle(slide, asText(result.title, input.title));
  slide.addText(asText(result.executive_summary), { x: 0.65, y: 1.45, w: 11.8, h: 1.25, fontSize: 14, color: '334155', fit: 'shrink' });
  slide.addText(`Tipo: ${asText(result.requirement_type)}\nCategoria: ${asText(result.category)}\nCompletitud: ${asText(result.completion_level)} (${asText(result.completion_score)}%)\nRiesgo: ${asText(result.risk_level)}`, {
    x: 0.7,
    y: 3.1,
    w: 5.6,
    h: 1.3,
    fontSize: 12,
    color: '475569',
    fit: 'shrink',
  });
  addPptFooter(slide, input);

  slide = pptx.addSlide();
  addPptTitle(slide, 'Mini dashboard del requerimiento');
  addPptRows(slide, asArray(result.dashboard_metrics).map(asRecord), { maxRows: 8 });
  addPptFooter(slide, input);

  slide = pptx.addSlide();
  addPptTitle(slide, 'Termino de referencia', 'Objetivo, alcance, justificacion y datos clave.');
  slide.addText(`Objetivo: ${asText(document.objective)}\n\nAlcance: ${asText(document.scope)}\n\nJustificacion: ${asText(document.justification)}`, {
    x: 0.65,
    y: 1.35,
    w: 11.8,
    h: 5.2,
    fontSize: 12,
    color: '334155',
    fit: 'shrink',
    breakLine: false,
  });
  addPptFooter(slide, input);

  [
    ['Actividades y entregables', [...asArray(document.required_activities).map((item) => `Actividad: ${asText(item)}`), ...asArray(document.final_deliverables).map((item) => `Entregable: ${asText(item)}`)]],
    ['Seguridad y condiciones para proveedores', [...asArray(document.safety_requirements).map((item) => `Seguridad: ${asText(item)}`), ...asArray(document.supplier_conditions).map((item) => `Condicion: ${asText(item)}`)]],
    ['Checklist de calidad', asArray(result.checklist).map((item) => `${asText(asRecord(item).label)} - ${asText(asRecord(item).status)}`)],
  ].forEach(([title, items]) => {
    slide = pptx.addSlide();
    addPptTitle(slide, String(title));
    slide.addText((items as string[]).map((item) => `- ${asText(item)}`).join('\n'), { x: 0.7, y: 1.35, w: 11.7, h: 5.2, fontSize: 12, color: '334155', fit: 'shrink', breakLine: false });
    addPptFooter(slide, input);
  });

  slide = pptx.addSlide();
  addPptTitle(slide, 'Bases sugeridas para licitacion');
  slide.addText(`Objeto: ${asText(bases.object)}\n\nAlcance: ${asText(bases.scope)}\n\nCriterios: ${asArray(bases.evaluation_criteria).map(asText).join(', ')}\n\nAdvertencia: ${asText(bases.disclaimer)}`, {
    x: 0.65,
    y: 1.35,
    w: 11.8,
    h: 5.2,
    fontSize: 12,
    color: '334155',
    fit: 'shrink',
    breakLine: false,
  });
  addPptFooter(slide, input);

  slide = pptx.addSlide();
  addPptTitle(slide, 'Correo sugerido para proveedores');
  slide.addText(`Asunto: ${asText(email.subject)}\n\n${asText(email.greeting)}\n\n${asText(email.body)}\n\nAdjuntos: ${asArray(email.attached_documents).map(asText).join(', ')}\nPlazo: ${asText(email.response_deadline)}\nContacto: ${asText(email.contact_details)}\n\n${asText(email.closing)}`, {
    x: 0.65,
    y: 1.25,
    w: 11.8,
    h: 5.5,
    fontSize: 11,
    color: '334155',
    fit: 'shrink',
    breakLine: false,
  });
  addPptFooter(slide, input);

  slide = pptx.addSlide();
  addPptTitle(slide, 'Proceso sugerido de licitacion');
  addPptRows(slide, termsListRows(asArray(result.tender_process), 'Paso'), { maxRows: 10 });
  addPptFooter(slide, input);

  await pptx.writeFile({ fileName: getDefaultFileName(input, 'pptx') });
}

async function downloadDashboardResultPptx(input: AgentExportInput, result: Record<string, unknown>) {
  const pptxgen = (await import('pptxgenjs')).default;
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Buyer Nodus';
  pptx.subject = input.agentName || input.title;
  pptx.title = asText(result.dashboard_title, input.title);
  pptx.company = getBrandName(input.pdfMode ?? 'standard_branded', input.pdfOptions) || 'Buyer Nodus';
  pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'es-PE' };

  let slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
  slide.addText(getBrandName(input.pdfMode ?? 'standard_branded', input.pdfOptions) || 'Dashboard ejecutivo', { x: 0.55, y: 0.35, w: 6, h: 0.25, fontSize: 9, bold: true, color: '6B63D9' });
  slide.addText(asText(result.dashboard_title, input.title), { x: 0.55, y: 1.0, w: 11.9, h: 0.85, fontSize: 29, bold: true, color: '09008B', fit: 'shrink' });
  slide.addText(asText(result.executive_summary), { x: 0.6, y: 2.15, w: 11.7, h: 1.25, fontSize: 14, color: '334155', fit: 'shrink' });
  slide.addText(`Audiencia: ${asText(result.audience)}\nPeriodo: ${asText(result.period)}\nConfianza: ${asText(result.confidence_level)}\nTipo de datos: ${asText(result.data_type)}`, {
    x: 0.65,
    y: 3.85,
    w: 5.2,
    h: 1.1,
    fontSize: 12,
    color: '475569',
    fit: 'shrink',
  });
  slide.addText(asText(result.confidence_reason), { x: 6.1, y: 3.85, w: 6.2, h: 1.1, fontSize: 11, color: '475569', fit: 'shrink' });
  addPptFooter(slide, input);

  const kpis = asArray(result.kpis).map(asRecord);
  if (kpis.length) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'KPIs principales');
    addPptRows(slide, kpis.map((kpi) => ({
      KPI: kpi.title,
      Valor: kpi.value,
      Descripcion: kpi.description,
      Fuente: kpi.source,
      Confianza: kpi.confidence,
    })), { maxRows: kpis.length });
    addPptFooter(slide, input);
  }

  asArray(result.charts).map(asRecord).forEach((chart) => {
    slide = pptx.addSlide();
    addPptTitle(slide, asText(chart.title, 'Grafico'), `${asText(chart.type)} | ${asText(chart.confidence)} | ${asText(chart.description)}`);
    addPptRows(slide, dashboardChartDataRows(chart), { x: 0.6, y: 1.35, w: 6.2, h: 4.7, maxRows: 9 });
    slide.addText(asText(chart.insight), { x: 7.05, y: 1.45, w: 5.55, h: 1.4, fontSize: 13, color: '334155', fit: 'shrink' });
    addPptFooter(slide, input);
  });

  asArray(result.tables).map(asRecord).forEach((table) => {
    slide = pptx.addSlide();
    addPptTitle(slide, asText(table.title, 'Tabla resumen'), asText(table.description, ''));
    const rows = dashboardTableRows(table);
    addPptRows(slide, rows, { maxRows: rows.length });
    addPptFooter(slide, input);
  });

  slide = pptx.addSlide();
  addPptTitle(slide, 'Insights y recomendaciones');
  const insightLines = asArray(result.insights).map(asRecord).map((item) => `${asText(item.title)}: ${asText(item.description)} Accion: ${asText(item.recommended_action)}`);
  const recommendationLines = asArray(result.recommendations).map((item) => `- ${asText(item)}`);
  slide.addText([...insightLines, '', ...recommendationLines].join('\n'), { x: 0.65, y: 1.3, w: 11.8, h: 5.25, fontSize: 11, color: '334155', fit: 'shrink', breakLine: false });
  addPptFooter(slide, input);

  slide = pptx.addSlide();
  addPptTitle(slide, 'Informacion faltante y calidad de datos');
  slide.addText([...asArray(result.missing_information), ...asArray(asRecord(result.data_profile).data_quality_warnings)].map((item) => `- ${asText(item)}`).join('\n') || 'Sin advertencias registradas.', {
    x: 0.65,
    y: 1.35,
    w: 11.8,
    h: 5.2,
    fontSize: 12,
    color: '334155',
    fit: 'shrink',
    breakLine: false,
  });
  addPptFooter(slide, input);

  await pptx.writeFile({ fileName: getDefaultFileName(input, 'pptx') });
}

async function downloadTcoResultPptx(input: AgentExportInput, result: Record<string, unknown>) {
  const pptxgen = (await import('pptxgenjs')).default;
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Buyer Nodus';
  pptx.subject = input.agentName || input.title;
  pptx.title = asText(result.analysis_title, input.title);
  pptx.company = getBrandName(input.pdfMode ?? 'standard_branded', input.pdfOptions) || 'Buyer Nodus';
  pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'es-PE' };

  const summary = asRecord(result.executive_summary);
  const recommendation = asRecord(result.strategic_recommendation);
  let slide = pptx.addSlide();
  addPptTitle(slide, asText(result.analysis_title, input.title));
  slide.addText(asText(summary.final_recommendation || summary.why_it_wins), { x: 0.65, y: 1.45, w: 11.8, h: 1.25, fontSize: 14, color: '334155', fit: 'shrink' });
  slide.addText(`Producto: ${asText(result.item_name)}\nHorizonte: ${asText(result.evaluation_horizon)}\nMoneda: ${asText(result.currency)}\nMejor alternativa: ${asText(summary.best_alternative)}`, {
    x: 0.7,
    y: 3.1,
    w: 6.2,
    h: 1.35,
    fontSize: 12,
    color: '475569',
    fit: 'shrink',
  });
  slide.addText(`Riesgo principal: ${asText(summary.main_risk)}\nAhorro/sobrecosto: ${asText(summary.estimated_saving_or_overcost)}`, {
    x: 7.1,
    y: 3.1,
    w: 5.4,
    h: 1.35,
    fontSize: 12,
    color: '475569',
    fit: 'shrink',
  });
  addPptFooter(slide, input);

  [
    ['Alternativas detectadas', tcoDetectedAlternativeRows(result)],
    ['Matriz TCO', tcoMatrixRows(result)],
    ['Ranking', tcoRankingRows(result)],
    ['Riesgos', tcoRiskRows(result)],
  ].forEach(([title, rows]) => {
    slide = pptx.addSlide();
    addPptTitle(slide, String(title));
    addPptRows(slide, rows as Array<Record<string, unknown>>, { maxRows: (rows as Array<Record<string, unknown>>).length });
    addPptFooter(slide, input);
  });

  slide = pptx.addSlide();
  addPptTitle(slide, 'Costos ocultos y sensibilidad');
  slide.addText([
    'Costos ocultos detectados:',
    ...asArray(result.hidden_costs_detected).map((item) => `- ${asText(item)}`),
    '',
    'Sensibilidad:',
    ...formatValue(result.sensitivity_analysis).slice(0, 10),
  ].join('\n'), { x: 0.65, y: 1.3, w: 11.8, h: 5.4, fontSize: 11, color: '334155', fit: 'shrink', breakLine: false });
  addPptFooter(slide, input);

  slide = pptx.addSlide();
  addPptTitle(slide, 'Recomendacion estrategica');
  slide.addText([
    `Accion recomendada: ${asText(recommendation.recommended_action)}`,
    '',
    'Puntos de negociacion:',
    ...asArray(recommendation.negotiation_points).map((item) => `- ${asText(item)}`),
    '',
    'Siguientes pasos:',
    ...asArray(recommendation.next_steps).map((item) => `- ${asText(item)}`),
  ].join('\n'), { x: 0.65, y: 1.3, w: 11.8, h: 5.4, fontSize: 12, color: '334155', fit: 'shrink', breakLine: false });
  addPptFooter(slide, input);

  slide = pptx.addSlide();
  addPptTitle(slide, 'Informacion faltante y preguntas');
  slide.addText([
    ...asArray(result.missing_information).map((item) => `- ${asText(item)}`),
    '',
    'Preguntas para proveedores:',
    ...asArray(result.questions_for_user_or_suppliers).map((item) => `- ${asText(item)}`),
  ].join('\n'), { x: 0.65, y: 1.3, w: 11.8, h: 5.4, fontSize: 11, color: '334155', fit: 'shrink', breakLine: false });
  addPptFooter(slide, input);

  await pptx.writeFile({ fileName: getDefaultFileName(input, 'pptx') });
}

async function downloadAgentResultPptx(input: AgentExportInput) {
  const result = asRecord(input.result);
  if (isTermsOfReferenceResult(result)) {
    await downloadTermsOfReferencePptx(input, result);
    return;
  }
  if (isDashboardResult(result)) {
    await downloadDashboardResultPptx(input, result);
    return;
  }
  if (isTcoAnalysisResult(result)) {
    await downloadTcoResultPptx(input, result);
    return;
  }
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
  slide.addText(`Agente: ${input.agentName || input.title}\nFecha: ${formatDate()}`, {
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
  if (objective) slide.addText(objective, { x: 0.6, y: 4.1, w: 11.7, h: 1.1, fontSize: 14, color: '1F2937', fit: 'shrink' });
  addPptFooter(slide, input);

  getExportSections(result).forEach(([key, value]) => {
    const rows = key === 'charts' ? chartRows(value) : rowsFromValue(value);
    slide = pptx.addSlide();
    addPptTitle(slide, formatLabel(key), 'Misma informacion generada por el agente en la plataforma.');

    if (rows.length && Object.keys(rows[0] ?? {}).length <= 5) {
      const keys = Object.keys(rows[0]).slice(0, 5);
      slide.addTable(
        [
          keys.map((name) => ({ text: name, options: { bold: true, color: '09008B', fill: 'EEF2FF' } })),
          ...rows.map((row) => keys.map((name) => ({ text: asText(row[name]), options: { color: '334155' } }))),
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

export async function downloadAgentResultPdf(input: PdfInput) {
  if (input.captureElementId) {
    const captured = await addCapturedDashboardPdf(input);
    if (captured) return;
  }
  addGenericPdf(input);
}

export async function downloadAgentResult(input: AgentExportInput) {
  if (input.format === 'pdf') {
    await downloadAgentResultPdf({ ...input, fileName: getDefaultFileName(input, 'pdf') });
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
