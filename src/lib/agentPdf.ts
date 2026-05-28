import jsPDF from 'jspdf';
import type { AgentPdfMode, AgentPdfOptions } from '@/types';
import {
  flattenTcoMatrixRows,
  normalizeTcoForPresentation,
  tcoKpiRows,
  type TcoPresentationModel,
} from '@/features/tco-analysis/tcoPresentation';
import type { TcoAnalysisResult } from '@/features/tco-analysis/tcoAnalysisApi';

const DASHBOARD_CREATOR_DISCLAIMER =
  'Este dashboard de compras fue generado con asistencia de IA a partir de los archivos cargados por el usuario. La información, indicadores y recomendaciones deben ser revisados y validados por el comprador antes de tomar decisiones finales.';

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
  recommended_action: 'Accion recomendada',
  economic_option: 'Mejor opcion economica',
  technical_option: 'Mejor opcion tecnica',
  lowest_risk_option: 'Mejor opcion por menor riesgo',
  balanced_option: 'Mejor opcion balanceada',
  final_recommended_option: 'Opcion recomendada final',
  recommendation_rationale: 'Justificacion de la recomendacion',
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
  'metadata',
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
  'tco_dashboard_matrix',
  'dashboard_matrix',
  'presentationModel',
  'base_parameters',
  'benchmark_assumptions',
  'financial_model',
  'scorecard',
  'transparency_table',
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

const dashboardTechnicalPatterns = [
  /python/i,
  /\bllm\b/i,
  /dataprofile/i,
  /dashboardplan/i,
  /candidatefields/i,
  /anti[-\s]?invenci/i,
  /backend/i,
  /source_component/i,
  /calculated/i,
  /indicador sugerido/i,
];

function dashboardBusinessText(value: unknown, fallback = '') {
  const text = asText(value, '').trim();
  if (!text) return fallback;
  if (dashboardTechnicalPatterns.some((pattern) => pattern.test(text))) return fallback;
  return text;
}

const dashboardEmptyValuePattern = /^(nan|null|undefined|none|n\/a|na)$/i;
const dashboardAmountColumnPattern = /monto|total|importe|valor|subtotal|saldo|precio|ahorro|gasto|cantidad|%|porcentaje/i;

function isDashboardEmptyValue(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return Number.isNaN(value);
  const text = asText(value, '').trim();
  return !text || dashboardEmptyValuePattern.test(text);
}

function hasDashboardNumericValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value);
  const numeric = Number(asText(value, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) && numeric !== 0;
}

function isDashboardUsefulRow(row: Record<string, unknown>, columns: string[]) {
  const dimensionColumns = columns.filter((column) => !dashboardAmountColumnPattern.test(column));
  const hasDimension = dimensionColumns.some((column) => !isDashboardEmptyValue(row[column]));
  const hasAnyValue = columns.some((column) => !isDashboardEmptyValue(row[column]));
  return hasAnyValue && (dimensionColumns.length ? hasDimension : true);
}

function sanitizeDashboardTable(table: Record<string, unknown>) {
  const title = dashboardBusinessText(table.title);
  const columns = asArray(table.columns).map((item) => dashboardBusinessText(item)).filter(Boolean);
  const proveedorColumn = columns.find((column) => /proveedor/i.test(column));
  const categoriaColumn = columns.find((column) => /categor/i.test(column));
  const montoColumn = columns.find((column) => dashboardAmountColumnPattern.test(column));
  const requiresProviderCategory = /matriz.*concentraci[oó]n.*proveedor.*categor/i.test(title)
    || Boolean(proveedorColumn && categoriaColumn && montoColumn);
  const rows = asArray(table.rows).map(asRecord).map((row) => columns.reduce<Record<string, unknown>>((cleaned, column) => {
    cleaned[column] = isDashboardEmptyValue(row[column]) ? '' : row[column];
    return cleaned;
  }, {})).filter((row) => {
    if (requiresProviderCategory) {
      return Boolean(
        proveedorColumn
        && categoriaColumn
        && montoColumn
        && !isDashboardEmptyValue(row[proveedorColumn])
        && !isDashboardEmptyValue(row[categoriaColumn])
        && hasDashboardNumericValue(row[montoColumn]),
      );
    }
    return isDashboardUsefulRow(row, columns);
  });
  return {
    title,
    description: dashboardBusinessText(table.description),
    columns,
    rows,
  };
}

function dashboardBusinessList(values: unknown[], limit = 12) {
  return values.map((item) => dashboardBusinessText(item)).filter(Boolean).slice(0, limit);
}

function dashboardBusinessKpis(result: Record<string, unknown>) {
  return asArray(result.kpis).map(asRecord).filter((kpi) => {
    const title = dashboardBusinessText(kpi.title);
    return title && kpi.value && !/registros analizados|columnas detectadas/i.test(title);
  });
}

function dashboardBusinessWarnings(result: Record<string, unknown>) {
  return dashboardBusinessList([
    ...asArray(asRecord(result.data_profile).data_quality_warnings),
    ...asArray(result.qualityWarnings),
  ], 10);
}

function dashboardBusinessFindings(result: Record<string, unknown>) {
  return asArray(result.findings).map(asRecord).filter((item) => (
    dashboardBusinessText(item.title)
    && dashboardBusinessText(item.description)
    && !['chart', 'kpi', 'table'].includes(dashboardBusinessText(item.description).toLowerCase())
  ));
}

function cleanPublicKpi(kpi: Record<string, unknown>) {
  return {
    title: kpi.title,
    value: kpi.value,
    unit: kpi.unit,
    description: dashboardBusinessText(kpi.description),
  };
}

function cleanPublicChart(chart: Record<string, unknown>) {
  return {
    chart_id: chart.chart_id,
    title: chart.title,
    type: chart.type,
    description: dashboardBusinessText(chart.description),
    x_axis: chart.x_axis,
    y_axis: chart.y_axis,
    data: chart.data,
    colors: chart.colors,
    legend: chart.legend,
    insight: dashboardBusinessText(chart.insight),
  };
}

function cleanPublicTable(table: Record<string, unknown>) {
  return sanitizeDashboardTable(table);
}

const dashboardPublicKeyBlocklist = new Set([
  'objective',
  'metadata',
  'confidence_level',
  'confidence_reason',
  'analysis_type',
  'analysis_mode',
  'data_profile',
  'dataProfile',
  'dashboardPlan',
  'data_understanding',
  'extracted_data_quality',
  'source_files',
  'document_summaries',
  'missing_information',
  'missingData',
  'qualityWarnings',
  'observations',
  'suggested_filters',
  'layout_suggestion',
  'visualConfig',
  'disclaimer',
]);

function buildPublicDashboardResult(result: Record<string, unknown>) {
  const cleaned: Record<string, unknown> = {};
  Object.entries(result).forEach(([key, value]) => {
    if (!dashboardPublicKeyBlocklist.has(key)) cleaned[key] = value;
  });
  cleaned.kpis = dashboardBusinessKpis(result).map(cleanPublicKpi);
  cleaned.charts = asArray(result.charts).map(asRecord).filter((chart) => chart.data && dashboardBusinessText(chart.title)).slice(0, 8).map(cleanPublicChart);
  cleaned.tables = asArray(result.tables).map(asRecord).map(sanitizeDashboardTable).filter((table) => {
    const title = dashboardBusinessText(table.title);
    return title
      && table.columns.length
      && table.rows.length
      && !/documentos procesados|archivos procesados|calidad|data\s*profile|datos faltantes|analisis no calculables/i.test(title);
  }).slice(0, 4).map(cleanPublicTable);
  cleaned.findings = dashboardBusinessFindings(result).map((item) => ({
    title: item.title,
    description: dashboardBusinessText(item.description),
  }));
  cleaned.recommendations = dashboardBusinessList(asArray(result.recommendations), 8);
  cleaned.insights = asArray(result.insights).map(asRecord).filter((item) => dashboardBusinessText(item.title) || dashboardBusinessText(item.description)).slice(0, 8);
  return cleaned;
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

function ensureBlock(ctx: PdfContext, minimumHeight = 28) {
  ensurePage(ctx, minimumHeight);
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

function addSection(ctx: PdfContext, title: string, minimumBlockHeight = 22) {
  ensureBlock(ctx, minimumBlockHeight);
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

function addDashboardKpiCards(ctx: PdfContext, kpis: Record<string, unknown>[]) {
  if (!kpis.length) return;
  addSection(ctx, 'KPIs principales');
  const gap = 4;
  const cardWidth = (ctx.maxWidth - gap) / 2;
  kpis.slice(0, 8).forEach((kpi, index) => {
    if (index % 2 === 0) ensurePage(ctx, 34);
    const x = ctx.marginX + (index % 2) * (cardWidth + gap);
    const y = ctx.y;
    const status = asText(kpi.status, 'neutral');
    const accent = status === 'positive' ? '#B2EB4A' : status === 'critical' ? '#F3313F' : status === 'warning' ? '#F59E0B' : ctx.primaryColor;
    ctx.doc.setFillColor('#FFFFFF');
    ctx.doc.setDrawColor('#E2E8F0');
    ctx.doc.roundedRect(x, y, cardWidth, 28, 2, 2, 'FD');
    ctx.doc.setFillColor(accent);
    ctx.doc.rect(x, y, 2.2, 28, 'F');
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(7.5);
    ctx.doc.setTextColor('#64748B');
    ctx.doc.text(ctx.doc.splitTextToSize(asText(kpi.title), cardWidth - 10), x + 5, y + 6);
    ctx.doc.setFontSize(15);
    ctx.doc.setTextColor('#0F172A');
    ctx.doc.text(ctx.doc.splitTextToSize(asText(kpi.value), cardWidth - 10), x + 5, y + 15);
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(7);
    ctx.doc.setTextColor('#64748B');
    ctx.doc.text(ctx.doc.splitTextToSize(asText(kpi.description), cardWidth - 10), x + 5, y + 22);
    if (index % 2 === 1 || index === Math.min(kpis.length, 8) - 1) ctx.y += 32;
  });
}

function addDashboardChartVisual(ctx: PdfContext, chart: Record<string, unknown>) {
  const points = asArray(chart.data).map(asRecord).filter((point) => point.label && Number.isFinite(Number(point.value))).slice(0, 8);
  if (!points.length) return;
  ensureBlock(ctx, 44);
  addText(ctx, asText(chart.title, 'Grafico'), { size: 9.5, bold: true, color: '#0f172a' });
  const maxValue = Math.max(...points.map((point) => Number(point.value) || 0), 1);
  points.forEach((point, index) => {
    ensurePage(ctx, 9);
    const value = Number(point.value) || 0;
    const barWidth = Math.max(4, (value / maxValue) * (ctx.maxWidth - 58));
    const y = ctx.y;
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(7);
    ctx.doc.setTextColor('#475569');
    ctx.doc.text(ctx.doc.splitTextToSize(asText(point.label), 38), ctx.marginX, y + 4);
    ctx.doc.setFillColor('#EEF2FF');
    ctx.doc.roundedRect(ctx.marginX + 42, y, ctx.maxWidth - 58, 5, 1, 1, 'F');
    ctx.doc.setFillColor(index % 4 === 0 ? '#0E109E' : index % 4 === 1 ? '#5A31D5' : index % 4 === 2 ? '#F3313F' : '#B2EB4A');
    ctx.doc.roundedRect(ctx.marginX + 42, y, barWidth, 5, 1, 1, 'F');
    ctx.doc.setTextColor('#0F172A');
    ctx.doc.text(asText(value.toLocaleString('es-PE')), ctx.pageWidth - ctx.marginX, y + 4, { align: 'right' });
    ctx.y += 8;
  });
  if (chart.insight) addText(ctx, asText(chart.insight), { size: 8, color: '#64748b', gap: 1 });
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
  ensureBlock(ctx, headerHeight + 31);
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
    const legend = dashboardChartLegendText(record);
    return {
      chart: record.title,
      type: record.type,
      source: record.data_source ?? record.source,
      confidence: record.confidence,
      legend,
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

function tcoPresentationModel(result: Record<string, unknown>) {
  return normalizeTcoForPresentation(result as unknown as TcoAnalysisResult);
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
    Etiqueta: point.label,
    Valor: point.value,
  }));
}

function dashboardListRows(items: unknown[], valueKey = 'Valor') {
  return items.map((item, index) => ({ N: index + 1, [valueKey]: asText(item) }));
}

function proposalSuppliers(result: Record<string, unknown>) {
  return asArray(result.suppliers).map(asRecord);
}

function proposalSupplierNames(result: Record<string, unknown>) {
  return proposalSuppliers(result).map((supplier) => asText(supplier.supplier_name)).filter(Boolean);
}

function proposalExecutiveRows(result: Record<string, unknown>) {
  const supplierNames = proposalSupplierNames(result);
  return asArray(result.executive_comparison_table).map(asRecord).map((row) => {
    const values = asRecord(row.values);
    return {
      'Dato clave': row.row_label,
      ...supplierNames.reduce<Record<string, unknown>>((record, supplier) => {
        record[supplier] = values[supplier] || 'No especificado';
        return record;
      }, {}),
    };
  });
}

function proposalMatrixRows(result: Record<string, unknown>) {
  const supplierNames = proposalSupplierNames(result);
  return asArray(asRecord(result.evaluation_matrix).criteria).map(asRecord).map((criterion) => {
    const ratings = asRecord(criterion.ratings);
    return {
      N: criterion.number,
      Criterio: criterion.criterion,
      'Peso %': criterion.weight_percent,
      ...supplierNames.reduce<Record<string, unknown>>((record, supplier) => {
        record[supplier] = ratings[supplier] ?? 'No especificado';
        return record;
      }, {}),
      Observaciones: criterion.observations,
    };
  });
}

function proposalWeightedRows(result: Record<string, unknown>) {
  return asArray(asRecord(result.evaluation_matrix).weighted_totals).map(asRecord).map((item) => ({
    Proveedor: item.supplier_name,
    'Puntaje ponderado': Number.isFinite(Number(item.weighted_score))
      ? `${Number(item.weighted_score).toFixed(2)} / 5.00`
      : asText(item.weighted_score),
    Ranking: item.ranking_position,
  }));
}

function proposalCriteriaGuideRows(result: Record<string, unknown>) {
  return asArray(result.criteria_guide).map(asRecord).map((item) => ({
    N: item.number,
    Criterio: item.criterion,
    'Peso %': item.weight_percent,
    'Escala de valoracion 1 a 5': item.evaluation_scale_description,
    'Fuente de verificacion': item.verification_source,
  }));
}

function proposalRankingRows(result: Record<string, unknown>) {
  return asArray(result.ranking).map(asRecord).map((item) => ({
    Posicion: item.position,
    Proveedor: item.supplier_name,
    Puntaje: item.weighted_score ? `${Number(item.weighted_score).toFixed(2)} / 5` : `${asText(item.score)} / 100`,
    Motivo: item.reason,
  }));
}

function proposalComparisonRows(result: Record<string, unknown>) {
  const supplierNames = proposalSupplierNames(result);
  return asArray(result.comparison_table).map(asRecord).map((row) => {
    const values = asRecord(row.values);
    return {
      Criterio: row.criterion,
      ...supplierNames.reduce<Record<string, unknown>>((record, supplier) => {
        record[supplier] = values[supplier] || 'No especificado';
        return record;
      }, {}),
      Comentario: row.comment,
    };
  });
}

function proposalListRows(items: unknown[], valueKey: string) {
  return items.map((item, index) => ({ N: index + 1, [valueKey]: asText(item) }));
}

function dashboardChartLegendText(chart: Record<string, unknown>) {
  const explicitLegend = asArray(chart.legend).map(asRecord);
  if (explicitLegend.length) {
    return explicitLegend.map((item) => `${asText(item.label)}${item.value ? `: ${asText(item.value)}` : ''}`).join('; ');
  }
  return asArray(chart.data).map(asRecord).map((point) => `${asText(point.label)}: ${asText(point.value)}`).join('; ');
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
    Evidencia: asArray(item.source_evidence).join(' | '),
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
  return flattenTcoMatrixRows(tcoPresentationModel(result));
}

function tcoRankingRows(result: Record<string, unknown>) {
  const model = tcoPresentationModel(result);
  return model.ranking.map(asRecord).map((item) => ({
    Posicion: item.position,
    Alternativa: item.alternative,
    Calificacion: item.score,
    Nivel: item.score_label,
    TCO: item.total_tco,
    Base: asArray(item.source_basis).join(' | '),
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

function tcoFinancialRows(model: TcoPresentationModel) {
  return model.financialModel.map((item) => ({
    Alternativa: item.alternative,
    Adquisicion: item.acquisition_costs,
    Logistica: item.logistics_costs,
    Implementacion: item.implementation_costs,
    Operacion: item.operating_costs,
    Mantenimiento: item.maintenance_costs,
    Soporte: item.support_costs,
    Seguros: item.insurance_costs,
    Riesgo: item.risk_costs,
    Residual: item.residual_value,
    'TCO neto': item.net_tco,
    'TCO anual': item.annualized_tco,
    'TCO unitario': item.unit_tco,
    Confianza: item.confidence_level,
  }));
}

function tcoScorecardRows(model: TcoPresentationModel) {
  return model.scorecard.criteria.flatMap((criterion) => {
    const item = asRecord(criterion);
    return asArray(item.alternatives).map(asRecord).map((score) => ({
      Criterio: item.criterion_name,
      Peso: item.weight,
      Alternativa: score.alternative,
      Puntaje: score.normalized_score,
      Ponderado: score.weighted_score,
      Evidencia: score.evidence,
      Fuente: score.source,
      Confianza: score.confidence_level,
    }));
  });
}

function tcoScorecardTotalRows(model: TcoPresentationModel) {
  return model.scorecard.totals.map((item) => ({
    Posicion: item.rank,
    Alternativa: item.alternative,
    Score: item.total_score,
    Nivel: item.level,
    Fortaleza: item.main_strength,
    Debilidad: item.main_weakness,
    Confianza: item.confidence_level,
  }));
}

function tcoTransparencyRows(model: TcoPresentationModel) {
  return model.transparencyTable.map((item) => ({
    Alternativa: item.alternative,
    Dato: item.field,
    Valor: item.value,
    Fuente: item.source,
    Confianza: item.confidence_level,
    Observacion: item.observation,
  }));
}

function tcoBenchmarkRows(model: TcoPresentationModel) {
  return model.benchmarkAssumptions.map((item) => ({
    Campo: item.field,
    Valor: item.value,
    Min: item.range_min,
    Max: item.range_max,
    Unidad: item.unit,
    Tipo: item.source_type,
    Confianza: item.confidence_level,
    Aplica: item.applies_to,
    Advertencia: item.warning,
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

function tcoBaseRows(result: Record<string, unknown>) {
  const model = tcoPresentationModel(result);
  const summary = asRecord(result.executive_summary);
  return [
    { Campo: 'Titulo del analisis', Valor: model.header.title },
    { Campo: 'Producto o servicio', Valor: model.header.itemName },
    { Campo: 'Tipo de analisis', Valor: model.header.analysisType },
    { Campo: 'Horizonte', Valor: model.header.horizon },
    { Campo: 'Unidad de comparacion', Valor: model.header.unitOfComparison },
    { Campo: 'Moneda', Valor: model.header.currency },
    { Campo: 'Mejor alternativa', Valor: asText(summary.best_alternative) },
    { Campo: 'Score ganador', Valor: `${asText(summary.best_alternative_score)} / 100 - ${asText(summary.best_alternative_score_label)}` },
    { Campo: 'Ahorro o sobrecosto', Valor: asText(summary.estimated_saving_or_overcost) },
    { Campo: 'Riesgo principal', Valor: asText(summary.main_risk) },
    ...tcoKpiRows(model).map((item) => ({ Campo: item.KPI, Valor: item.Valor, Nota: item.Nota })),
  ];
}

function tcoRecommendationRows(result: Record<string, unknown>) {
  const summary = asRecord(result.executive_summary);
  const recommendation = asRecord(result.strategic_recommendation);
  const ranking = tcoRankingRows(result);
  return [
    { Seccion: 'Resumen ejecutivo', Campo: 'Recomendacion final', Valor: asText(summary.final_recommendation) },
    { Seccion: 'Resumen ejecutivo', Campo: 'Motivo', Valor: asText(summary.why_it_wins) },
    { Seccion: 'Recomendacion estrategica', Campo: 'Accion recomendada', Valor: asText(recommendation.recommended_action) },
    { Seccion: 'Recomendacion estrategica', Campo: 'Mejor opcion economica', Valor: asText(recommendation.economic_option) },
    { Seccion: 'Recomendacion estrategica', Campo: 'Mejor opcion tecnica', Valor: asText(recommendation.technical_option) },
    { Seccion: 'Recomendacion estrategica', Campo: 'Mejor opcion por menor riesgo', Valor: asText(recommendation.lowest_risk_option) },
    { Seccion: 'Recomendacion estrategica', Campo: 'Mejor opcion balanceada', Valor: asText(recommendation.balanced_option) },
    { Seccion: 'Recomendacion estrategica', Campo: 'Opcion recomendada final', Valor: asText(recommendation.final_recommended_option) },
    { Seccion: 'Recomendacion estrategica', Campo: 'Justificacion', Valor: asText(recommendation.recommendation_rationale) },
    ...ranking.map((item) => ({
      Seccion: 'Ranking',
      Campo: `${asText(item.Posicion)}. ${asText(item.Alternativa)}`,
      Valor: `Score ${asText(item.Calificacion)} (${asText(item.Nivel)}). TCO: ${asText(item.TCO)}. ${asText(item.Motivo)}`,
    })),
    ...asArray(recommendation.negotiation_points).map((item, index) => ({
      Seccion: 'Puntos de negociacion',
      Campo: `Punto ${index + 1}`,
      Valor: asText(item),
    })),
    ...asArray(recommendation.next_steps).map((item, index) => ({
      Seccion: 'Proximos pasos',
      Campo: `Paso ${index + 1}`,
      Valor: asText(item),
    })),
    ...asArray(result.missing_information).map((item, index) => ({
      Seccion: 'Datos faltantes',
      Campo: `Dato ${index + 1}`,
      Valor: asText(item),
    })),
    ...asArray(result.assumptions_and_limits).map((item, index) => ({
      Seccion: 'Supuestos y limites',
      Campo: `Supuesto ${index + 1}`,
      Valor: asText(item),
    })),
  ].filter((row) => row.Valor && row.Valor !== 'No especificado');
}

function renderTcoMatrixForPdf(ctx: PdfContext, model: TcoPresentationModel) {
  const alternatives = model.alternatives.slice(0, 3);
  const headers = ['Componente', ...alternatives.map((item) => item.label), 'Nota'];
  const componentWidth = 46;
  const noteWidth = 36;
  const altWidth = Math.max((ctx.maxWidth - componentWidth - noteWidth) / Math.max(alternatives.length, 1), 24);
  const widths = [componentWidth, ...alternatives.map(() => altWidth), noteWidth];

  model.matrix.forEach((section) => {
    const rows = [...section.rows, ...(section.totalRow ? [section.totalRow] : [])];
    if (!rows.length) return;
    addText(ctx, section.title, { size: 9.4, bold: true, color: '#0f172a', gap: 2 });
    if (section.description) addText(ctx, section.description, { size: 8, color: '#64748b', gap: 1 });
    addTable(
      ctx,
      headers,
      rows.map((row) => [
        row.isTotal ? row.component.toUpperCase() : row.component,
        ...alternatives.map((alternative) => row.values[alternative.label] ?? 'Dato faltante'),
        [row.source, row.unit, row.note].filter(Boolean).join(' - ') || '-',
      ]),
      widths,
    );
  });
}

function renderTcoMatrixForWordRows(model: TcoPresentationModel) {
  return model.matrix.flatMap((section) => [
    { Seccion: section.title, Componente: section.description || section.title },
    ...[...section.rows, ...(section.totalRow ? [section.totalRow] : [])].map((row) => ({
      Seccion: section.title,
      Componente: row.isTotal ? row.component.toUpperCase() : row.component,
      ...row.values,
      Nota: [row.source, row.unit, row.note].filter(Boolean).join(' - '),
    })),
  ]);
}

function renderTcoMatrixForPptRows(model: TcoPresentationModel, sectionTitle?: string) {
  const sections = sectionTitle ? model.matrix.filter((section) => section.title === sectionTitle) : model.matrix;
  return sections.flatMap((section) =>
    [...section.rows, ...(section.totalRow ? [section.totalRow] : [])].map((row) => ({
      Seccion: section.title,
      Componente: row.component,
      ...row.values,
      Nota: [row.source, row.unit, row.note].filter(Boolean).join(' - '),
    })),
  );
}

function renderTcoScorecardForPdf(ctx: PdfContext, model: TcoPresentationModel) {
  const totals = tcoScorecardTotalRows(model);
  if (totals.length) {
    addTable(
      ctx,
      ['Pos', 'Alternativa', 'Score', 'Nivel', 'Motivo'],
      totals.map((item) => [item.Posicion, item.Alternativa, item.Score, item.Nivel, `Fortaleza: ${asText(item.Fortaleza)}. Debilidad: ${asText(item.Debilidad)}.`]),
      [13, 36, 18, 30, ctx.maxWidth - 97],
    );
  }
  const rows = tcoScorecardRows(model).slice(0, 18);
  if (rows.length) {
    addTable(
      ctx,
      ['Criterio', 'Peso', 'Alternativa', 'Puntaje', 'Evidencia'],
      rows.map((item) => [item.Criterio, item.Peso, item.Alternativa, item.Puntaje, `${asText(item.Evidencia)} (${asText(item.Confianza)})`]),
      [38, 15, 34, 19, ctx.maxWidth - 106],
    );
  }
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
    asText(result.executive_summary),
  ]);

  addCard(ctx, 'Proveedor recomendado', [recommendedName], 'green');

  const executiveRows = asArray(result.executive_comparison_table).map(asRecord);
  if (executiveRows.length) {
    addSection(ctx, 'Resumen ejecutivo comparativo');
    const supplierNames = suppliers.map((supplier) => asText(supplier.supplier_name));
    addTable(
      ctx,
      ['Dato clave', ...supplierNames],
      executiveRows.map((row) => {
        const values = asRecord(row.values);
        return [row.row_label, ...supplierNames.map((name) => values[name] ?? 'No especificado')];
      }),
      [36, ...supplierNames.map(() => (ctx.maxWidth - 36) / Math.max(supplierNames.length, 1))],
    );
  }

  const matrix = asRecord(result.evaluation_matrix);
  const criteria = asArray(matrix.criteria).map(asRecord);
  if (criteria.length && suppliers.length) {
    addSection(ctx, 'Matriz de evaluación comparativa');
    addText(ctx, asText(result.auto_generated_criteria_note), { size: 8, color: '#64748b' });
    addText(ctx, 'Escala de valoración: 1 = Muy deficiente | 2 = Deficiente | 3 = Aceptable | 4 = Bueno | 5 = Excelente. Puntaje ponderado = Valoración x Peso.', { size: 8, color: '#64748b', gap: 1 });
    const supplierNames = suppliers.map((supplier) => asText(supplier.supplier_name));
    addTable(
      ctx,
      ['N', 'Criterio', 'Peso %', ...supplierNames, 'Observaciones'],
      criteria.map((criterion) => {
        const ratings = asRecord(criterion.ratings);
        return [
          criterion.number,
          criterion.criterion,
          `${asText(criterion.weight_percent)}%`,
          ...supplierNames.map((name) => asText(ratings[name], 'No especificado')),
          criterion.observations,
        ];
      }),
      [10, 34, 17, ...supplierNames.map(() => 20), ctx.maxWidth - 61 - supplierNames.length * 20],
    );
  }

  const weightedTotals = asArray(matrix.weighted_totals).map(asRecord);
  if (weightedTotals.length) {
    addSection(ctx, 'Puntaje ponderado total');
    addTable(
      ctx,
      ['Proveedor', 'Puntaje ponderado', 'Ranking'],
      weightedTotals.map((item) => [
        item.supplier_name,
        Number.isFinite(Number(item.weighted_score)) ? `${Number(item.weighted_score).toFixed(2)} / 5.00` : item.weighted_score,
        item.ranking_position,
      ]),
      [70, 55, 35],
    );
  }

  const criteriaGuide = asArray(result.criteria_guide).map(asRecord);
  if (criteriaGuide.length) {
    addSection(ctx, 'Guía de criterios');
    addTable(
      ctx,
      ['N', 'Criterio', 'Peso %', 'Escala de valoracion 1 a 5', 'Fuente de verificacion'],
      criteriaGuide.map((item) => [item.number, item.criterion, `${asText(item.weight_percent)}%`, item.evaluation_scale_description, item.verification_source]),
      [10, 34, 17, 66, ctx.maxWidth - 127],
    );
  }

  addSection(ctx, 'Ranking');
  addTable(
    ctx,
    ['Posicion', 'Proveedor', 'Puntaje', 'Motivo'],
    ranking.map((item, index) => [
      item.position ?? index + 1,
      item.supplier_name,
      item.weighted_score ? `${Number(item.weighted_score).toFixed(2)} / 5` : `${asText(item.score)} / 100`,
      item.reason,
    ]),
    [18, 42, 28, ctx.maxWidth - 88],
  );

  addSection(ctx, 'Tabla comparativa');
  const supplierNames = suppliers.map((supplier) => asText(supplier.supplier_name));
  addTable(
    ctx,
    ['Criterio', ...supplierNames, 'Comentario'],
    asArray(result.comparison_table).map(asRecord).map((row) => {
      const values = asRecord(row.values);
      return [row.criterion, ...supplierNames.map((name) => values[name] || 'No especificado'), row.comment];
    }),
    [36, ...supplierNames.map(() => 28), ctx.maxWidth - 36 - supplierNames.length * 28],
  );

  addSection(ctx, 'Riesgos globales');
  addBulletList(ctx, 'Riesgos globales', asArray(result.global_risks), 12);

  addSection(ctx, 'Información faltante');
  addBulletList(ctx, 'Información faltante', asArray(result.missing_information), 12);

  addSection(ctx, 'Preguntas sugeridas');
  addBulletList(ctx, 'Preguntas sugeridas', asArray(result.questions_for_suppliers), 12);

  addCard(ctx, 'Recomendación final', asText(result.final_recommendation), 'green');
  addAdditionalResultSections(ctx, result, [
    'analysis_title',
    'service',
    'objective',
    'recommended_supplier',
    'executive_summary',
    'suppliers',
    'ranking',
    'auto_generated_criteria_note',
    'evaluation_scale',
    'evaluation_matrix',
    'criteria_guide',
    'executive_comparison_table',
    'comparison_table',
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
  const result = buildPublicDashboardResult(asRecord(input.result));
  const ctx = createContext(input);
  ctx.primaryColor = '#0E109E';
  const subtitle = `Audiencia: ${asText(result.audience)} | Periodo: ${asText(result.period)}`;
  const metadata = asRecord(result.metadata);
  const executiveSummary = asRecord(result.executiveSummary);

  addHeader(ctx, input, subtitle);
  addCard(ctx, 'Resumen ejecutivo', [
    dashboardBusinessText(executiveSummary.information_found, asText(result.executive_summary)),
    dashboardBusinessText(executiveSummary.analysis_built, 'Reporte ejecutivo generado a partir de los archivos cargados, con indicadores calculados segun la informacion disponible.'),
    `Tipo de datos: ${asText(result.data_type)}`,
    `Reporte: ${asText(metadata.report_name, asText(result.dashboard_title))}`,
  ]);

  const kpis = dashboardBusinessKpis(result);
  if (kpis.length) {
    addDashboardKpiCards(ctx, kpis);
    ensureBlock(ctx, 42);
    addTable(
      ctx,
      ['Indicador', 'Valor', 'Interpretacion breve'],
      kpis.map((kpi) => [dashboardBusinessText(kpi.title), kpi.value, dashboardBusinessText(kpi.description)]),
      [46, 34, ctx.maxWidth - 80],
    );
  }

  const charts = asArray(result.charts).map(asRecord);
  if (charts.length) {
    addSection(ctx, 'Graficos principales', 48);
    charts.slice(0, 5).forEach((chart) => addDashboardChartVisual(ctx, chart));
  }

  const tables = asArray(result.tables).map(asRecord);
  if (tables.length) {
    addSection(ctx, 'Tablas del dashboard', 44);
    tables.slice(0, 2).forEach((table) => {
      const rows = dashboardTableRows(table);
      const keys = Object.keys(rows[0] ?? {}).slice(0, 5);
      if (!keys.length) return;
      ensureBlock(ctx, 42);
      addText(ctx, asText(table.title, 'Tabla resumen'), { size: 9.5, bold: true, color: '#0f172a' });
      if (table.description) addText(ctx, asText(table.description), { size: 8.5, color: '#64748b' });
      addTable(
        ctx,
        keys,
        rows.slice(0, 10).map((row) => keys.map((key) => row[key])),
        keys.map(() => ctx.maxWidth / keys.length),
      );
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

  addSection(ctx, 'Recomendaciones');
  addBulletList(ctx, 'Acciones sugeridas', asArray(result.recommendations), 8);
  const findings = dashboardBusinessFindings(result);
  if (findings.length) {
    addSection(ctx, 'Hallazgos con evidencia', 42);
    addTable(
      ctx,
      ['Hallazgo', 'Descripcion'],
      findings.map((item) => [dashboardBusinessText(item.title), dashboardBusinessText(item.description)]),
      [54, ctx.maxWidth - 54],
    );
  }

  addSection(ctx, 'Disclaimer');
  addText(ctx, DASHBOARD_CREATOR_DISCLAIMER, {
    size: 8.5,
    color: '#64748b',
  });
  addFooter(ctx);
  ctx.doc.save(input.fileName ?? 'dashboard-nodus-ia.pdf');
}

function addTcoAnalysisPdf(input: PdfInput) {
  const result = asRecord(input.result);
  const ctx = createContext(input);
  const model = tcoPresentationModel(result);
  const summary = asRecord(result.executive_summary);
  const scoreWinner = tcoScorecardTotalRows(model)[0];
  const subtitle = `${model.header.analysisType} | Horizonte: ${model.header.horizon} | Moneda: ${model.header.currency}`;

  addHeader(ctx, input, subtitle);
  addCard(ctx, 'Portada ejecutiva TCO', [
    `Producto/servicio: ${model.header.itemName}`,
    `Alternativa recomendada: ${model.recommendation.finalRecommendedOption || asText(summary.best_alternative)}`,
    `Score ganador: ${asText(scoreWinner?.Score ?? summary.best_alternative_score)} / 100 - ${asText(scoreWinner?.Nivel ?? summary.best_alternative_score_label)}`,
    `Confianza: ${model.scorecard.confidenceLevel || asText(asRecord(result.extracted_data_quality).confidence_level)}`,
    `Recomendacion breve: ${asText(model.recommendation.rationale || summary.final_recommendation).slice(0, 260)}`,
  ], 'green');

  addSection(ctx, 'KPIs y resumen ejecutivo');
  addTable(
    ctx,
    ['KPI', 'Valor', 'Nota'],
    model.kpis.map((item) => [item.label, item.value, item.note ?? '']),
    [44, 42, ctx.maxWidth - 86],
  );

  addSection(ctx, 'Matriz TCO comparativa');
  renderTcoMatrixForPdf(ctx, model);

  const financialRows = tcoFinancialRows(model);
  if (financialRows.length) {
    addSection(ctx, 'Modelo financiero TCO');
    addTable(
      ctx,
      ['Alternativa', 'TCO neto', 'TCO anual', 'TCO unitario', 'Confianza'],
      financialRows.map((item) => [item.Alternativa, item['TCO neto'], item['TCO anual'], item['TCO unitario'], item.Confianza]),
      [42, 34, 34, 34, ctx.maxWidth - 144],
    );
  }

  addSection(ctx, 'Scorecard y ranking');
  renderTcoScorecardForPdf(ctx, model);

  const risks = tcoRiskRows(result);
  if (risks.length) {
    addSection(ctx, 'Riesgos principales');
    addTable(
      ctx,
      ['Riesgo', 'Alternativa', 'Probabilidad', 'Impacto', 'Nivel', 'Mitigacion'],
      risks.map((item) => [item.Riesgo, item.Alternativa, item.Probabilidad, item.Impacto, item.Nivel, item.Mitigacion]),
      [34, 30, 24, 30, 20, ctx.maxWidth - 138],
    );
  }

  const transparency = tcoTransparencyRows(model).slice(0, 18);
  if (transparency.length) {
    addSection(ctx, 'Transparencia de datos');
    addTable(
      ctx,
      ['Dato', 'Valor', 'Fuente', 'Confianza', 'Observacion'],
      transparency.map((item) => [item.Dato, item.Valor, item.Fuente, item.Confianza, item.Observacion]),
      [40, 34, 24, 24, ctx.maxWidth - 122],
    );
  }

  const benchmarks = tcoBenchmarkRows(model).slice(0, 10);
  if (benchmarks.length) {
    addSection(ctx, 'Benchmarks y datos faltantes');
    addTable(
      ctx,
      ['Campo', 'Valor', 'Tipo', 'Confianza', 'Advertencia'],
      benchmarks.map((item) => [item.Campo, item.Valor, item.Tipo, item.Confianza, item.Advertencia]),
      [40, 32, 24, 24, ctx.maxWidth - 120],
    );
  }
  addBulletList(ctx, 'Datos faltantes criticos', model.missingData, 6);

  addSection(ctx, 'Recomendacion final');
  addTable(
    ctx,
    ['Campo', 'Detalle'],
    [
      ['Opcion recomendada', model.recommendation.finalRecommendedOption],
      ['Accion', model.recommendation.recommendedAction],
      ['Justificacion', model.recommendation.rationale],
      ['Proximos pasos', model.recommendation.nextSteps.slice(0, 5).join(' | ')],
    ],
    [42, ctx.maxWidth - 42],
  );

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
        ['Grafico', 'Tipo', 'Fuente', 'Confianza', 'Leyenda', 'Datos mostrados', 'Insight'],
        rows.map((row) => [row.chart, row.type, row.source, row.confidence, row.legend, row.data, row.insight]),
        [24, 16, 18, 17, 36, 44, ctx.maxWidth - 155],
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

function addTermsOfReferencePdf(input: PdfInput) {
  const result = asRecord(input.result);
  const ctx = createContext(input);
  const document = getTermsDocument(result);
  const general = getTermsGeneralData(result);
  const bases = getTermsTenderBases(result);
  const email = getTermsEmail(result);
  const subtitle = `Tipo: ${asText(result.requirement_type)} | Categoria: ${asText(result.category)} | Riesgo: ${asText(result.risk_level)}`;

  addHeader(ctx, input, subtitle);
  addCard(ctx, 'Resumen ejecutivo', [
    asText(result.executive_summary),
    `Completitud: ${asText(result.completion_level)} (${asText(result.completion_score)}%)`,
    `Ubicacion: ${asText(general.location)} | Fecha requerida: ${asText(general.required_date)}`,
  ]);

  const metrics = asArray(result.dashboard_metrics).map(asRecord);
  if (metrics.length) {
    addSection(ctx, 'Metricas del requerimiento');
    addTable(
      ctx,
      ['Metrica', 'Valor', 'Estado'],
      metrics.map((item) => [item.label ?? item.metric, item.value, item.status]),
      [70, 45, ctx.maxWidth - 115],
    );
  }

  addSection(ctx, 'Documento generado');
  addTable(
    ctx,
    ['Campo', 'Contenido'],
    [
      ['Nombre', general.requirement_name ?? result.title],
      ['Tipo', general.requirement_type ?? result.requirement_type],
      ['Categoria', general.category ?? result.category],
      ['Ubicacion', general.location],
      ['Fecha requerida', general.required_date],
      ['Objetivo', document.objective],
      ['Alcance', document.scope],
      ['Justificacion', document.justification],
    ],
    [42, ctx.maxWidth - 42],
  );
  addBulletList(ctx, 'Caracteristicas tecnicas', asArray(document.technical_characteristics), 30);
  addBulletList(ctx, 'Actividades requeridas', asArray(document.required_activities), 30);
  addBulletList(ctx, 'Entregables finales', asArray(document.final_deliverables), 30);
  addBulletList(ctx, 'Requisitos de seguridad', asArray(document.safety_requirements), 30);
  addBulletList(ctx, 'Condiciones para proveedores', asArray(document.supplier_conditions), 30);
  addBulletList(ctx, 'Estructura de informe final', asArray(document.final_report_structure), 30);
  addBulletList(ctx, 'Anexos sugeridos', asArray(document.suggested_annexes), 30);

  const checklist = asArray(result.checklist).map(asRecord);
  if (checklist.length) {
    addSection(ctx, 'Checklist de calidad');
    addTable(
      ctx,
      ['Punto', 'Estado', 'Detalle'],
      checklist.map((item) => [item.label, item.status, item.detail]),
      [52, 26, ctx.maxWidth - 78],
    );
  }

  addSection(ctx, 'Bases sugeridas para licitacion');
  addTable(
    ctx,
    ['Seccion', 'Contenido'],
    [
      ['Objeto', bases.object],
      ['Alcance', bases.scope],
      ['Requisitos minimos del proveedor', asArray(bases.minimum_supplier_requirements).map(asText).join('\n')],
      ['Documentacion solicitada', asArray(bases.requested_documentation).map(asText).join('\n')],
      ['Criterios de evaluacion', asArray(bases.evaluation_criteria).map(asText).join('\n')],
      ['Condiciones de presentacion', asArray(bases.proposal_submission_conditions).map(asText).join('\n')],
      ['Plazo de consultas', bases.question_deadline],
      ['Fecha limite de propuestas', bases.proposal_deadline],
      ['Forma de envio', bases.submission_method],
      ['Criterios de adjudicacion', asArray(bases.award_criteria).map(asText).join('\n')],
      ['Condiciones de descalificacion', asArray(bases.disqualification_conditions).map(asText).join('\n')],
      ['Observaciones para compradores', asArray(bases.buyer_observations).map(asText).join('\n')],
      ['Advertencia', bases.disclaimer],
    ],
    [50, ctx.maxWidth - 50],
  );

  addSection(ctx, 'Correo sugerido para proveedores');
  addTable(
    ctx,
    ['Campo', 'Contenido'],
    [
      ['Asunto', email.subject],
      ['Saludo', email.greeting],
      ['Cuerpo', email.body],
      ['Adjuntos', asArray(email.attached_documents).map(asText).join(', ')],
      ['Plazo de respuesta', email.response_deadline],
      ['Contacto', email.contact_details],
      ['Cierre', email.closing],
    ],
    [38, ctx.maxWidth - 38],
  );

  addSection(ctx, 'Proceso y acciones');
  addBulletList(ctx, 'Flujo del requerimiento', asArray(result.flow_steps), 30);
  addBulletList(ctx, 'Proceso sugerido de licitacion', asArray(result.tender_process), 30);
  addBulletList(ctx, 'Informacion faltante', asArray(result.missing_information), 30);
  addBulletList(ctx, 'Recomendaciones accionables', asArray(result.buyer_recommendations), 30);

  const supportDocs = asArray(result.supporting_documents_summary).map(asRecord);
  if (supportDocs.length) {
    addSection(ctx, 'Documentos de apoyo leidos');
    addTable(
      ctx,
      ['Archivo', 'Tipo', 'Hallazgos', 'Limitaciones'],
      supportDocs.map((item) => [
        item.file_name ?? item.name,
        item.detected_type ?? item.type,
        asArray(item.relevant_findings).map(asText).join('\n'),
        asArray(item.limitations).map(asText).join('\n'),
      ]),
      [42, 24, 64, ctx.maxWidth - 130],
    );
  }

  addAdditionalResultSections(ctx, result, [
    'title',
    'requirement_type',
    'category',
    'completion_level',
    'completion_score',
    'risk_level',
    'executive_summary',
    'dashboard_metrics',
    'generated_document',
    'checklist',
    'tender_bases',
    'supplier_invitation_email',
    'flow_steps',
    'tender_process',
    'missing_information',
    'buyer_recommendations',
    'supporting_documents_summary',
    'disclaimer',
  ]);
  addSection(ctx, 'Disclaimer');
  addText(ctx, asText(result.disclaimer, 'Documento generado por Nodus IA como apoyo a decisiones de compra. Validar datos criticos antes de tomar decisiones finales.'), {
    size: 8.5,
    color: '#64748b',
  });
  addFooter(ctx);
  ctx.doc.save(input.fileName ?? 'termino-referencia-nodus-ia.pdf');
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

function appendAoaSheet(
  XLSX: XlsxModule,
  workbook: import('xlsx').WorkBook,
  used: Set<string>,
  name: string,
  rows: unknown[][],
  widths: number[] = [],
) {
  if (!rows.length) return;
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = widths.map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, sheet, normalizeSheetName(name, used));
}

async function downloadDashboardResultXlsx(input: AgentExportInput, result: Record<string, unknown>) {
  const technicalResult = result;
  result = buildPublicDashboardResult(result);
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Buyer Nodus';
  workbook.created = new Date();
  workbook.modified = new Date();
  const executiveSummary = asRecord(result.executiveSummary);
  const businessKpis = dashboardBusinessKpis(result);
  const charts = asArray(result.charts).map(asRecord);
  const tables = asArray(result.tables).map(asRecord);
  const primary = '0E109E';
  const secondary = '5A31D5';
  const danger = 'F3313F';
  const success = 'B2EB4A';
  const borderColor = 'CBD5E1';
  const textColor = '0F172A';

  const styleHeader = (row: import('exceljs').Row, fill = primary) => {
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: { argb: borderColor } } };
    });
  };
  const styleTable = (worksheet: import('exceljs').Worksheet, headerRow = 1) => {
    styleHeader(worksheet.getRow(headerRow));
    worksheet.views = [{ state: 'frozen', ySplit: headerRow }];
    worksheet.columns.forEach((column) => {
      let width = 14;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        width = Math.max(width, Math.min(String(cell.value ?? '').length + 4, 48));
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } },
        };
      });
      column.width = width;
    });
  };
  const addRowsSheet = (name: string, rows: Array<Record<string, unknown>>) => {
    if (!rows.length) return undefined;
    const worksheet = workbook.addWorksheet(name.slice(0, 31));
    const keys = Object.keys(rows[0] ?? {});
    worksheet.addRow(keys);
    rows.forEach((row) => worksheet.addRow(keys.map((key) => row[key] ?? '')));
    styleTable(worksheet);
    worksheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + Math.min(keys.length, 26))}1` };
    return worksheet;
  };
  const addSectionTitle = (worksheet: import('exceljs').Worksheet, rowNumber: number, title: string, fill = primary) => {
    worksheet.mergeCells(rowNumber, 1, rowNumber, 6);
    const cell = worksheet.getCell(rowNumber, 1);
    cell.value = title;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 };
    cell.alignment = { vertical: 'middle' };
  };
  const barText = (value: unknown, max: number) => {
    const numeric = Number(value) || 0;
    const length = Math.max(1, Math.round((numeric / Math.max(max, 1)) * 18));
    return '█'.repeat(length);
  };

  const summary = workbook.addWorksheet('Resumen Ejecutivo', { views: [{ showGridLines: false }] });
  summary.columns = [{ width: 22 }, { width: 24 }, { width: 24 }, { width: 24 }, { width: 24 }, { width: 42 }];
  summary.mergeCells('A1:F1');
  summary.getCell('A1').value = 'BUYER NODUS | Dashboard ejecutivo de compras';
  summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primary } };
  summary.getCell('A1').font = { bold: true, color: { argb: 'FFFFFF' }, size: 15 };
  summary.getCell('A1').alignment = { vertical: 'middle' };
  summary.getRow(1).height = 26;
  summary.mergeCells('A3:F3');
  summary.getCell('A3').value = asText(result.dashboard_title, input.title);
  summary.getCell('A3').font = { bold: true, color: { argb: textColor }, size: 20 };
  summary.getCell('A4').value = 'Fecha';
  summary.getCell('B4').value = formatDate();
  summary.getCell('C4').value = 'Audiencia';
  summary.getCell('D4').value = asText(result.audience);
  summary.getCell('E4').value = 'Periodo';
  summary.getCell('F4').value = asText(result.period);
  ['A4', 'C4', 'E4'].forEach((address) => {
    summary.getCell(address).font = { bold: true, color: { argb: primary } };
  });

  addSectionTitle(summary, 6, 'KPIs principales', secondary);
  businessKpis.slice(0, 6).forEach((kpi, index) => {
    const startCol = 1 + (index % 3) * 2;
    const startRow = 8 + Math.floor(index / 3) * 4;
    summary.mergeCells(startRow, startCol, startRow, startCol + 1);
    summary.mergeCells(startRow + 1, startCol, startRow + 1, startCol + 1);
    summary.mergeCells(startRow + 2, startCol, startRow + 2, startCol + 1);
    summary.getCell(startRow, startCol).value = dashboardBusinessText(kpi.title);
    summary.getCell(startRow + 1, startCol).value = asText(kpi.value);
    summary.getCell(startRow + 2, startCol).value = dashboardBusinessText(kpi.description);
    [startRow, startRow + 1, startRow + 2].forEach((row) => {
      for (let col = startCol; col <= startCol + 1; col += 1) {
        const cell = summary.getCell(row, col);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
        cell.border = {
          top: { style: 'thin', color: { argb: borderColor } },
          bottom: { style: 'thin', color: { argb: borderColor } },
          left: { style: 'thin', color: { argb: borderColor } },
          right: { style: 'thin', color: { argb: borderColor } },
        };
        cell.alignment = { vertical: 'middle', wrapText: true };
      }
    });
    summary.getCell(startRow, startCol).font = { bold: true, color: { argb: primary }, size: 10 };
    summary.getCell(startRow + 1, startCol).font = { bold: true, color: { argb: textColor }, size: 16 };
    summary.getCell(startRow + 2, startCol).font = { color: { argb: '475569' }, size: 9 };
  });

  addSectionTitle(summary, 17, 'Resumen ejecutivo', primary);
  summary.mergeCells('A18:F19');
  summary.getCell('A18').value = dashboardBusinessText(executiveSummary.information_found, asText(result.executive_summary));
  summary.getCell('A18').alignment = { wrapText: true, vertical: 'top' };
  addSectionTitle(summary, 21, 'Hallazgos y recomendaciones', secondary);
  let rowIndex = 22;
  asArray(result.findings).map(asRecord).slice(0, 4).forEach((item) => {
    summary.getCell(rowIndex, 1).value = dashboardBusinessText(item.title);
    summary.getCell(rowIndex, 2).value = dashboardBusinessText(item.description);
    summary.mergeCells(rowIndex, 2, rowIndex, 6);
    rowIndex += 1;
  });
  asArray(result.recommendations).slice(0, 5).forEach((item, index) => {
    summary.getCell(rowIndex, 1).value = `Accion ${index + 1}`;
    summary.getCell(rowIndex, 2).value = asText(item);
    summary.mergeCells(rowIndex, 2, rowIndex, 6);
    rowIndex += 1;
  });
  addSectionTitle(summary, rowIndex + 1, 'Disclaimer', primary);
  summary.mergeCells(rowIndex + 2, 1, rowIndex + 3, 6);
  summary.getCell(rowIndex + 2, 1).value = DASHBOARD_CREATOR_DISCLAIMER;
  summary.getCell(rowIndex + 2, 1).alignment = { wrapText: true, vertical: 'top' };

  addRowsSheet('KPIs', businessKpis.map((kpi) => ({
    KPI: kpi.title,
    Valor: kpi.value,
    Unidad: kpi.unit,
    Descripcion: kpi.description,
  })));

  const chartSheet = workbook.addWorksheet('Graficos', { views: [{ showGridLines: false }] });
  chartSheet.columns = [{ width: 34 }, { width: 34 }, { width: 16 }, { width: 34 }, { width: 60 }];
  let chartRow = 1;
  charts.slice(0, 6).forEach((chart) => {
    addSectionTitle(chartSheet, chartRow, asText(chart.title, 'Grafico'), primary);
    chartRow += 1;
    const rows = dashboardChartDataRows(chart);
    const max = Math.max(...rows.map((row) => Number(row.Valor) || 0), 1);
    const header = chartSheet.addRow(['Grafico', 'Etiqueta', 'Valor', 'Visual', 'Interpretacion']);
    styleHeader(header, secondary);
    rows.slice(0, 12).forEach((row) => {
      const excelRow = chartSheet.addRow([row.Grafico, row.Etiqueta, row.Valor, barText(row.Valor, max), dashboardBusinessText(chart.insight)]);
      excelRow.getCell(4).font = { color: { argb: primary }, bold: true };
    });
    chartRow = chartSheet.rowCount + 2;
  });
  styleTable(chartSheet, 2);

  addRowsSheet('Indicadores Calculados', businessKpis);
  addRowsSheet('Datos Procesados', charts.flatMap(dashboardChartDataRows));

  const tablesSheet = workbook.addWorksheet('Tablas Ejecutivas', { views: [{ showGridLines: false }] });
  tablesSheet.columns = [{ width: 28 }, { width: 28 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }];
  let tableRow = 1;
  tables.forEach((table) => {
    const rows = dashboardTableRows(table);
    if (!rows.length) return;
    addSectionTitle(tablesSheet, tableRow, asText(table.title, 'Tabla ejecutiva'), primary);
    tableRow += 1;
    const keys = Object.keys(rows[0]).slice(0, 6);
    styleHeader(tablesSheet.addRow(keys), secondary);
    rows.slice(0, 25).forEach((row) => tablesSheet.addRow(keys.map((key) => row[key])));
    tableRow = tablesSheet.rowCount + 2;
  });
  styleTable(tablesSheet, 2);

  addRowsSheet('Hallazgos y Recomendaciones', [
    ...asArray(result.findings).map(asRecord).map((item) => ({
      Tipo: 'Hallazgo',
      Titulo: item.title,
      Descripcion: item.description,
    })),
    ...asArray(result.insights).map(asRecord).map((item) => ({
      Tipo: 'Insight',
      Titulo: item.title,
      Descripcion: item.description,
      Accion: item.recommended_action,
    })),
    ...asArray(result.recommendations).map((item) => ({
      Tipo: 'Recomendacion',
      Titulo: '',
      Descripcion: asText(item),
    })),
  ]);
  addRowsSheet('Insights', asArray(result.insights).map(asRecord).map((item) => ({
    Insight: item.title,
    Descripcion: item.description,
    Impacto: item.impact,
    Accion: item.recommended_action,
  })));
  addRowsSheet('Recomendaciones', dashboardListRows(asArray(result.recommendations), 'Recomendacion'));
  addRowsSheet('Disclaimer', [{ Disclaimer: DASHBOARD_CREATOR_DISCLAIMER }]);
  addRowsSheet('Tecnico - DataProfile', asArray(asRecord(technicalResult.dataProfile || technicalResult.data_profile).columns).map(asRecord));

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), getDefaultFileName(input, 'xlsx'));
}

async function downloadProposalComparisonXlsx(input: AgentExportInput, result: Record<string, unknown>) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Buyer Nodus';
  workbook.created = new Date();
  workbook.modified = new Date();

  const primary = '0E109E';
  const secondary = '5A31D5';
  const success = 'B2EB4A';
  const warning = 'FFF3CD';
  const borderColor = 'CBD5E1';
  const textColor = '0F172A';
  const recommendedName = asText(result.recommended_supplier || getRecommendedRanking(result).supplier_name, 'No especificado');

  const styleHeader = (row: import('exceljs').Row, fill = primary) => {
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: { argb: borderColor } } };
    });
  };
  const styleSheet = (worksheet: import('exceljs').Worksheet, headerRows: number[] = [1]) => {
    headerRows.forEach((rowNumber, index) => styleHeader(worksheet.getRow(rowNumber), index % 2 === 0 ? primary : secondary));
    worksheet.views = [{ state: 'frozen', ySplit: Math.max(...headerRows) }];
    worksheet.columns.forEach((column) => {
      let width = 14;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        width = Math.max(width, Math.min(String(cell.value ?? '').length + 4, 58));
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } },
        };
      });
      column.width = width;
    });
  };
  const addRowsSheet = (name: string, rows: Array<Record<string, unknown>>, highlightRecommended = false) => {
    if (!rows.length) return undefined;
    const worksheet = workbook.addWorksheet(name.slice(0, 31), { views: [{ showGridLines: false }] });
    const keys = Object.keys(rows[0] ?? {});
    worksheet.addRow(keys);
    rows.forEach((row) => worksheet.addRow(keys.map((key) => row[key] ?? '')));
    styleSheet(worksheet);
    if (highlightRecommended) {
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const matchesRecommended = row.values?.toString().toLowerCase().includes(recommendedName.toLowerCase());
        if (!matchesRecommended) return;
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: success } };
          cell.font = { bold: true, color: { argb: textColor } };
        });
      });
    }
    worksheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + Math.min(keys.length, 26))}1` };
    return worksheet;
  };

  const summary = workbook.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  summary.columns = [{ width: 24 }, { width: 32 }, { width: 28 }, { width: 28 }, { width: 28 }, { width: 48 }];
  summary.mergeCells('A1:F1');
  summary.getCell('A1').value = 'BUYER NODUS | Comparativo de propuestas de proveedores';
  summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primary } };
  summary.getCell('A1').font = { bold: true, color: { argb: 'FFFFFF' }, size: 15 };
  summary.getRow(1).height = 26;
  summary.mergeCells('A3:F3');
  summary.getCell('A3').value = asText(result.analysis_title, input.title);
  summary.getCell('A3').font = { bold: true, color: { argb: textColor }, size: 20 };
  summary.getCell('A5').value = 'Servicio evaluado';
  summary.getCell('B5').value = asText(result.service, 'No especificado');
  summary.getCell('C5').value = 'Objetivo';
  summary.mergeCells('D5:F5');
  summary.getCell('D5').value = asText(result.objective, 'No especificado');
  summary.getCell('A7').value = 'Proveedor recomendado';
  summary.getCell('B7').value = recommendedName;
  summary.getCell('B7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: success } };
  summary.getCell('B7').font = { bold: true, color: { argb: textColor } };
  summary.mergeCells('A9:F11');
  summary.getCell('A9').value = asText(result.executive_summary);
  summary.getCell('A9').alignment = { wrapText: true, vertical: 'top' };
  summary.mergeCells('A13:F13');
  summary.getCell('A13').value = 'Recomendacion final';
  summary.getCell('A13').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: secondary } };
  summary.getCell('A13').font = { bold: true, color: { argb: 'FFFFFF' } };
  summary.mergeCells('A14:F16');
  summary.getCell('A14').value = asText(result.final_recommendation);
  summary.getCell('A14').alignment = { wrapText: true, vertical: 'top' };
  summary.mergeCells('A18:F19');
  summary.getCell('A18').value = asText(result.disclaimer);
  summary.getCell('A18').alignment = { wrapText: true, vertical: 'top' };
  ['A5', 'C5', 'A7'].forEach((address) => {
    summary.getCell(address).font = { bold: true, color: { argb: primary } };
  });
  summary.eachRow((row) => row.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
      left: { style: 'thin', color: { argb: 'E2E8F0' } },
      right: { style: 'thin', color: { argb: 'E2E8F0' } },
    };
    cell.alignment = { vertical: 'top', wrapText: true };
  }));

  addRowsSheet('Resumen comparativo', proposalExecutiveRows(result), true);
  addRowsSheet('Matriz evaluacion', proposalMatrixRows(result), true);
  addRowsSheet('Puntajes', proposalWeightedRows(result), true);
  addRowsSheet('Guia criterios', proposalCriteriaGuideRows(result));
  addRowsSheet('Ranking', proposalRankingRows(result), true);
  addRowsSheet('Tabla comparativa', proposalComparisonRows(result), true);
  addRowsSheet('Riesgos', proposalListRows(asArray(result.global_risks), 'Riesgo'), false)?.eachRow((row, rowNumber) => {
    if (rowNumber > 1) row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: warning } }; });
  });
  addRowsSheet('Informacion faltante', proposalListRows(asArray(result.missing_information), 'Informacion faltante'));
  addRowsSheet('Preguntas', proposalListRows(asArray(result.questions_for_suppliers), 'Pregunta sugerida'));
  addRowsSheet('Recomendacion', [
    { Seccion: 'Recomendacion final', Contenido: asText(result.final_recommendation) },
    { Seccion: 'Disclaimer', Contenido: asText(result.disclaimer) },
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), getDefaultFileName(input, 'xlsx'));
}

async function downloadTcoResultXlsx(input: AgentExportInput, result: Record<string, unknown>) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Buyer Nodus';
  workbook.created = new Date();
  workbook.modified = new Date();
  const model = tcoPresentationModel(result);
  const primary = '0D1B2A';
  const blue = '1565C0';
  const accent = '00ACC1';
  const green = '2E7D32';
  const gold = 'F9A825';
  const light = 'ECEFF1';
  const border = 'CFD8DC';

  const styleHeader = (row: import('exceljs').Row, fill = primary) => {
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: { argb: border } } };
    });
  };
  const styleSheet = (sheet: import('exceljs').Worksheet, headerRow = 1) => {
    styleHeader(sheet.getRow(headerRow));
    sheet.views = [{ state: 'frozen', ySplit: headerRow }];
    sheet.columns.forEach((column) => {
      let width = 14;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        width = Math.max(width, Math.min(String(cell.value ?? '').length + 4, 52));
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: border } },
          bottom: { style: 'thin', color: { argb: border } },
          left: { style: 'thin', color: { argb: border } },
          right: { style: 'thin', color: { argb: border } },
        };
      });
      column.width = width;
    });
  };
  const addRowsSheet = (name: string, rows: Array<Record<string, unknown>>) => {
    if (!rows.length) return undefined;
    const sheet = workbook.addWorksheet(name.slice(0, 31));
    const keys = Object.keys(rows[0] ?? {});
    sheet.addRow(keys);
    rows.forEach((row) => sheet.addRow(keys.map((key) => row[key] ?? 'Dato faltante')));
    styleSheet(sheet);
    sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + Math.min(keys.length, 26))}1` };
    return sheet;
  };

  const dashboard = workbook.addWorksheet('Dashboard TCO', { views: [{ showGridLines: false }] });
  dashboard.columns = [{ width: 28 }, { width: 32 }, { width: 32 }, { width: 32 }, { width: 44 }];
  dashboard.mergeCells('A1:E1');
  dashboard.getCell('A1').value = 'BUYER NODUS | Dashboard financiero TCO';
  dashboard.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFF' } };
  dashboard.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primary } };
  dashboard.addRow(['Titulo', model.header.title, 'Tipo', model.header.analysisType, formatDate()]);
  dashboard.addRow(['Producto/servicio', model.header.itemName, 'Horizonte', model.header.horizon, `Moneda: ${model.header.currency}`]);
  dashboard.addRow([]);
  styleHeader(dashboard.addRow(['KPI', 'Valor', 'Nota']), blue);
  model.kpis.forEach((item) => dashboard.addRow([item.label, item.value, item.note ?? '']));
  dashboard.addRow([]);
  styleHeader(dashboard.addRow(['Recomendacion', 'Detalle']), green);
  dashboard.addRow(['Opcion recomendada', model.recommendation.finalRecommendedOption]);
  dashboard.addRow(['Justificacion', model.recommendation.rationale]);
  dashboard.addRow(['Proximos pasos', model.recommendation.nextSteps.slice(0, 5).join(' | ')]);
  dashboard.eachRow((row) => row.eachCell((cell) => {
    cell.alignment = { vertical: 'top', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: border } } };
  }));

  const matrixRows = model.matrix.flatMap((section) => [
    { Seccion: section.title, Componente: section.description || section.title, ...Object.fromEntries(model.alternatives.map((alt) => [alt.label, ''])), Fuente: '', Unidad: '', Nota: '' },
    ...[...section.rows, ...(section.totalRow ? [section.totalRow] : [])].map((row) => ({
      Seccion: section.title,
      Componente: row.component,
      ...row.values,
      Fuente: row.source ?? '',
      Unidad: row.unit ?? '',
      Nota: row.note ?? '',
    })),
  ]);
  const matrixSheet = addRowsSheet('Matriz TCO', matrixRows);
  matrixSheet?.eachRow((row, rowNumber) => {
    const section = String(row.getCell(1).value ?? '');
    const component = String(row.getCell(2).value ?? '');
    const isSectionRow = rowNumber > 1 && section === component;
    const isTotalRow = rowNumber > 1 && /total|tco neto|tco anual|tco unitario/i.test(component);
    if (isSectionRow) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: light } };
        cell.font = { bold: true, color: { argb: primary } };
      });
    }
    if (isTotalRow) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8F5E9' } };
        cell.font = { bold: true, color: { argb: green } };
      });
    }
  });

  addRowsSheet('Scorecard', tcoScorecardRows(model));
  addRowsSheet('Ranking', tcoScorecardTotalRows(model).length ? tcoScorecardTotalRows(model) : tcoRankingRows(result));
  addRowsSheet('Modelo financiero', tcoFinancialRows(model));
  addRowsSheet('Riesgos', tcoRiskRows(result));
  addRowsSheet('Transparencia', tcoTransparencyRows(model));
  addRowsSheet('Supuestos benchmarks', tcoBenchmarkRows(model));
  addRowsSheet('Datos faltantes', dashboardListRows(model.missingData, 'Dato faltante'));
  addRowsSheet('Recomendacion', tcoRecommendationRows(result));

  workbook.eachSheet((sheet) => {
    sheet.getRow(1).height = 24;
    sheet.properties.defaultRowHeight = 18;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), getDefaultFileName(input, 'xlsx'));
}

async function downloadAgentResultXlsx(input: AgentExportInput) {
  const XLSX = await import('xlsx');
  const result = asRecord(input.result);
  if (isDashboardResult(result)) {
    await downloadDashboardResultXlsx(input, result);
    return;
  }
  if (isProposalComparison(result)) {
    await downloadProposalComparisonXlsx(input, result);
    return;
  }
  if (isTcoAnalysisResult(result)) {
    await downloadTcoResultXlsx(input, result);
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
    appendJsonSheet(XLSX, workbook, used, 'Flujo requerimiento', termsListRows(asArray(result.flow_steps), 'Paso'));
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

function docxKpiCards(docx: DocxModule, kpis: Record<string, unknown>[]): import('docx').Table | undefined {
  const visible = kpis.slice(0, 6);
  if (!visible.length) return undefined;
  const rows = [];
  for (let index = 0; index < visible.length; index += 2) {
    const pair = visible.slice(index, index + 2);
    rows.push(new docx.TableRow({
      children: pair.map((kpi) => new docx.TableCell({
        shading: { fill: 'F8FAFC' },
        margins: { top: 180, bottom: 180, left: 180, right: 180 },
        borders: {
          top: { style: docx.BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
          bottom: { style: docx.BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
          left: { style: docx.BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
          right: { style: docx.BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
        },
        children: [
          docxParagraph(docx, dashboardBusinessText(kpi.title), { bold: true, color: '09008B' }),
          docxParagraph(docx, asText(kpi.value), { bold: true, color: '0F172A' }),
          docxParagraph(docx, dashboardBusinessText(kpi.description), { color: '475569' }),
        ],
      })),
    }));
  }
  return new docx.Table({ width: { size: 100, type: docx.WidthType.PERCENTAGE }, rows });
}

function docxDashboardCover(docx: DocxModule, result: Record<string, unknown>, input: AgentExportInput): import('docx').Table {
  return new docx.Table({
    width: { size: 100, type: docx.WidthType.PERCENTAGE },
    rows: [
      new docx.TableRow({
        children: [
          new docx.TableCell({
            shading: { fill: '0E109E' },
            margins: { top: 360, bottom: 360, left: 360, right: 360 },
            children: [
              docxParagraph(docx, 'BUYER NODUS', { bold: true, color: 'FFFFFF' }),
              docxParagraph(docx, asText(result.dashboard_title, input.title), { heading: true, color: 'FFFFFF' }),
              docxParagraph(docx, `Dashboard ejecutivo de compras | ${formatDate()}`, { color: 'FFFFFF' }),
            ],
          }),
        ],
      }),
      new docx.TableRow({
        children: [
          new docx.TableCell({
            shading: { fill: 'F8FAFC' },
            margins: { top: 180, bottom: 180, left: 240, right: 240 },
            children: [
              docxParagraph(docx, `Audiencia: ${asText(result.audience)} | Periodo: ${asText(result.period)} | Tipo de datos: ${asText(result.data_type)}`, { color: '334155' }),
            ],
          }),
        ],
      }),
    ],
  });
}

function dashboardChartVisualRows(chart: Record<string, unknown>) {
  const rows = dashboardChartDataRows(chart).slice(0, 10);
  const max = Math.max(...rows.map((row) => Number(row.Valor) || 0), 1);
  return rows.map((row) => {
    const value = Number(row.Valor) || 0;
    const barLength = Math.max(1, Math.round((value / max) * 18));
    return {
      Segmento: row.Etiqueta,
      Valor: row.Valor,
      Visual: String.fromCharCode(0x2588).repeat(barLength),
    };
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

  children.push(docxParagraph(docx, 'Metricas del requerimiento', { heading: true }));
  const metricsTable = docxTableFromRows(docx, asArray(result.dashboard_metrics).map(asRecord).map((item) => ({
    Metrica: item.label ?? item.metric,
    Valor: item.value,
    Estado: item.status,
  })));
  if (metricsTable) children.push(metricsTable);
  pushDocxList(docx, children, 'Flujo del requerimiento', asArray(result.flow_steps));

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
  pushDocxList(docx, children, 'Observaciones para compradores', asArray(bases.buyer_observations));
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
  children.push(docxParagraph(docx, 'Documentos de apoyo leidos', { heading: true }));
  const supportDocsTable = docxTableFromRows(docx, asArray(result.supporting_documents_summary).map(asRecord).map((item) => ({
    Archivo: item.file_name ?? item.name,
    Tipo: item.detected_type ?? item.type,
    Hallazgos: asArray(item.relevant_findings).map(asText).join('\n'),
    Limitaciones: asArray(item.limitations).map(asText).join('\n'),
  })));
  if (supportDocsTable) children.push(supportDocsTable);
  children.push(docxParagraph(docx, 'Disclaimer', { heading: true }));
  children.push(docxParagraph(docx, asText(result.disclaimer)));

  const doc = new docx.Document({ sections: [{ children }] });
  const blob = await docx.Packer.toBlob(doc);
  downloadBlob(blob, getDefaultFileName(input, 'docx'));
}

async function downloadTcoResultDocx(input: AgentExportInput, result: Record<string, unknown>) {
  const docx = await import('docx');
  const model = tcoPresentationModel(result);
  const summary = asRecord(result.executive_summary);
  const recommendation = asRecord(result.strategic_recommendation);
  const children: DocxChild[] = [
    docxParagraph(docx, asText(result.analysis_title, input.title), { heading: true }),
    docxParagraph(docx, `Informe ejecutivo editable | Fecha: ${formatDate()}`),
    docxParagraph(docx, `Agente: ${input.agentName || input.title}`),
    docxParagraph(docx, `Producto o servicio: ${asText(result.item_name)} | Horizonte: ${asText(result.evaluation_horizon)} | Moneda: ${asText(result.currency)}`),
    docxParagraph(docx, 'Resumen ejecutivo', { heading: true }),
    docxParagraph(docx, `Mejor alternativa preliminar: ${asText(summary.best_alternative)}`),
    docxParagraph(docx, `Calificacion: ${asText(summary.best_alternative_score)} / 100 - ${asText(summary.best_alternative_score_label)}`),
    docxParagraph(docx, `Motivo: ${asText(summary.why_it_wins)}`),
    docxParagraph(docx, `Ahorro o sobrecosto: ${asText(summary.estimated_saving_or_overcost)}`),
    docxParagraph(docx, `Riesgo principal: ${asText(summary.main_risk)}`),
    docxParagraph(docx, `Recomendacion final: ${asText(summary.final_recommendation)}`),
    docxParagraph(docx, 'Tipo de analisis e indicadores principales', { heading: true }),
  ];
  const baseTable = docxTableFromRows(docx, tcoBaseRows(result));
  if (baseTable) children.push(baseTable);

  const documentTable = docxTableFromRows(docx, asArray(result.supporting_documents_summary).map(asRecord).map((item) => ({
    Archivo: item.file_name ?? item.name,
    Tipo: item.detected_type ?? item.type,
    Hallazgos: asArray(item.relevant_findings).map((finding) => asText(finding, '')).join(' | '),
    Limitaciones: asArray(item.limitations).map((limitation) => asText(limitation, '')).join(' | '),
  })));
  if (documentTable) {
    children.push(docxParagraph(docx, 'Informacion utilizada', { heading: true }));
    children.push(documentTable);
  }

  [
    ['Matriz TCO', renderTcoMatrixForWordRows(model)],
    ['Modelo financiero', tcoFinancialRows(model)],
    ['Scorecard', tcoScorecardRows(model).slice(0, 30)],
    ['Ranking gerencial', tcoScorecardTotalRows(model).length ? tcoScorecardTotalRows(model) : tcoRankingRows(result)],
    ['Riesgos principales', tcoRiskRows(result)],
    ['Transparencia', tcoTransparencyRows(model).slice(0, 25)],
    ['Benchmarks y supuestos', tcoBenchmarkRows(model).slice(0, 20)],
  ].forEach(([title, rows]) => {
    children.push(docxParagraph(docx, String(title), { heading: true }));
    const table = docxTableFromRows(docx, rows as Array<Record<string, unknown>>);
    if (table) children.push(table);
  });

  pushDocxList(docx, children, 'Costos ocultos detectados', asArray(result.hidden_costs_detected));
  children.push(docxParagraph(docx, 'Recomendacion estrategica', { heading: true }));
  children.push(docxParagraph(docx, `Accion recomendada: ${asText(recommendation.recommended_action)}`));
  children.push(docxParagraph(docx, `Mejor opcion economica: ${asText(recommendation.economic_option)}`));
  children.push(docxParagraph(docx, `Mejor opcion tecnica: ${asText(recommendation.technical_option)}`));
  children.push(docxParagraph(docx, `Mejor opcion por menor riesgo: ${asText(recommendation.lowest_risk_option)}`));
  children.push(docxParagraph(docx, `Mejor opcion balanceada: ${asText(recommendation.balanced_option)}`));
  children.push(docxParagraph(docx, `Opcion recomendada final: ${asText(recommendation.final_recommended_option)}`));
  children.push(docxParagraph(docx, `Justificacion: ${asText(recommendation.recommendation_rationale)}`));
  pushDocxList(docx, children, 'Puntos de negociacion', asArray(recommendation.negotiation_points));
  pushDocxList(docx, children, 'Siguientes pasos', asArray(recommendation.next_steps));
  pushDocxList(docx, children, 'Informacion faltante', asArray(result.missing_information));
  pushDocxList(docx, children, 'Preguntas sugeridas para proveedores', asArray(result.questions_for_user_or_suppliers));
  pushDocxList(docx, children, 'Supuestos y limites', asArray(result.assumptions_and_limits));
  children.push(docxParagraph(docx, 'Conclusion', { heading: true }));
  children.push(docxParagraph(docx, asText(recommendation.recommendation_rationale || summary.final_recommendation)));
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
    const publicResult = buildPublicDashboardResult(result);
    Object.keys(result).forEach((key) => delete result[key]);
    Object.assign(result, publicResult);
    const executiveSummary = asRecord(result.executiveSummary);
    const kpis = dashboardBusinessKpis(result);
    const charts = asArray(result.charts).map(asRecord);
    const tables = asArray(result.tables).map(asRecord);
    const children: DocxChild[] = [
      docxDashboardCover(docx, result, input),
      docxParagraph(docx, 'Resumen ejecutivo', { heading: true }),
      docxParagraph(docx, dashboardBusinessText(executiveSummary.information_found, asText(result.executive_summary))),
      docxParagraph(docx, dashboardBusinessText(executiveSummary.analysis_built, 'Reporte ejecutivo generado a partir de los archivos cargados.')),
      docxParagraph(docx, 'KPIs principales', { heading: true }),
    ];

    const kpiCards = docxKpiCards(docx, kpis);
    if (kpiCards) children.push(kpiCards);

    children.push(docxParagraph(docx, 'Graficos principales', { heading: true }));
    charts.slice(0, 5).forEach((chart) => {
      children.push(docxParagraph(docx, asText(chart.title, 'Grafico'), { bold: true, color: '09008B' }));
      if (chart.description) children.push(docxParagraph(docx, dashboardBusinessText(chart.description), { color: '475569' }));
      const visualTable = docxTableFromRows(docx, dashboardChartVisualRows(chart));
      if (visualTable) children.push(visualTable);
      if (chart.insight) children.push(docxParagraph(docx, dashboardBusinessText(chart.insight), { color: '475569' }));
    });

    tables.forEach((table) => {
      children.push(docxParagraph(docx, asText(table.title, 'Tabla resumen'), { heading: true }));
      if (table.description) children.push(docxParagraph(docx, asText(table.description)));
      const nativeTable = docxTableFromRows(docx, dashboardTableRows(table));
      if (nativeTable) children.push(nativeTable);
    });

    children.push(docxParagraph(docx, 'Insights y recomendaciones', { heading: true }));
    asArray(result.insights).map(asRecord).forEach((item) => {
      children.push(docxParagraph(docx, `${asText(item.title)}: ${asText(item.description)} Accion: ${asText(item.recommended_action)}`));
    });
    asArray(result.recommendations).forEach((item) => children.push(docxParagraph(docx, `- ${asText(item)}`)));

    children.push(docxParagraph(docx, 'Hallazgos ejecutivos', { heading: true }));
    const findingsTable = docxTableFromRows(docx, asArray(result.findings).map(asRecord).map((item) => ({
      Hallazgo: dashboardBusinessText(item.title),
      Descripcion: dashboardBusinessText(item.description),
    })));
    if (findingsTable) children.push(findingsTable);

    children.push(docxParagraph(docx, 'Disclaimer', { heading: true }));
    children.push(docxParagraph(docx, DASHBOARD_CREATOR_DISCLAIMER));

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

function addPptKpiCards(slide: PptxSlide, kpis: Record<string, unknown>[]) {
  const visible = kpis.slice(0, 6);
  const colors = ['0E109E', '5A31D5', 'F3313F', 'B2EB4A', '2F80ED', '22A06B'];
  visible.forEach((kpi, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 0.6 + col * 4.1;
    const y = 1.35 + row * 2.1;
    slide.addShape('roundRect', {
      x,
      y,
      w: 3.75,
      h: 1.55,
      fill: { color: 'FFFFFF' },
      line: { color: 'CBD5E1', pt: 1 },
      radius: 0.12,
    });
    slide.addShape('rect', { x, y, w: 0.08, h: 1.55, fill: { color: colors[index % colors.length] }, line: { color: colors[index % colors.length] } });
    slide.addText(dashboardBusinessText(kpi.title), { x: x + 0.18, y: y + 0.14, w: 3.35, h: 0.25, fontSize: 8, bold: true, color: '64748B', fit: 'shrink' });
    slide.addText(asText(kpi.value), { x: x + 0.18, y: y + 0.45, w: 3.35, h: 0.42, fontSize: 18, bold: true, color: '0F172A', fit: 'shrink' });
    slide.addText(dashboardBusinessText(kpi.description), { x: x + 0.18, y: y + 0.95, w: 3.35, h: 0.38, fontSize: 7, color: '64748B', fit: 'shrink' });
  });
}

function addPptChartVisual(slide: PptxSlide, chart: Record<string, unknown>, options: { x?: number; y?: number; w?: number; h?: number } = {}) {
  const x = options.x ?? 0.7;
  const y = options.y ?? 1.35;
  const w = options.w ?? 7.1;
  const rows = dashboardChartDataRows(chart).slice(0, 8);
  if (!rows.length) return;
  const max = Math.max(...rows.map((row) => Number(row.Valor) || 0), 1);
  rows.forEach((row, index) => {
    const lineY = y + index * 0.47;
    const value = Number(row.Valor) || 0;
    const barW = Math.max(0.2, (value / max) * (w - 2.8));
    slide.addText(asText(row.Etiqueta), { x, y: lineY, w: 2.25, h: 0.22, fontSize: 7.5, color: '475569', fit: 'shrink' });
    slide.addShape('rect', { x: x + 2.35, y: lineY + 0.04, w: w - 3.1, h: 0.18, fill: { color: 'EEF2FF' }, line: { color: 'EEF2FF' } });
    slide.addShape('rect', { x: x + 2.35, y: lineY + 0.04, w: barW, h: 0.18, fill: { color: index % 4 === 0 ? '0E109E' : index % 4 === 1 ? '5A31D5' : index % 4 === 2 ? 'F3313F' : 'B2EB4A' }, line: { color: 'FFFFFF' } });
    slide.addText(asText(row.Valor), { x: x + w - 0.7, y: lineY - 0.01, w: 0.8, h: 0.22, fontSize: 7, color: '0F172A', align: 'right', fit: 'shrink' });
  });
}

function addPptProposalTable(slide: PptxSlide, rows: Array<Record<string, unknown>>, options: { x?: number; y?: number; w?: number; h?: number; maxRows?: number; fontSize?: number } = {}) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const visibleRows = rows.slice(0, options.maxRows ?? 9);
  slide.addTable(
    [
      keys.map((name) => ({ text: name, options: { bold: true, color: '09008B', fill: 'EEF2FF' } })),
      ...visibleRows.map((row) => keys.map((name) => ({ text: asText(row[name]), options: { color: '334155' } }))),
    ],
    {
      x: options.x ?? 0.55,
      y: options.y ?? 1.35,
      w: options.w ?? 12.2,
      h: options.h ?? 5.3,
      border: { color: 'CBD5E1', pt: 0.5 },
      fontSize: options.fontSize ?? (keys.length > 6 ? 6.2 : 8),
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
  addPptTitle(slide, 'Flujo del requerimiento');
  addPptRows(slide, termsListRows(asArray(result.flow_steps), 'Paso'), { maxRows: 12 });
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
    ['Caracteristicas tecnicas', asArray(document.technical_characteristics)],
    ['Actividades y entregables', [...asArray(document.required_activities).map((item) => `Actividad: ${asText(item)}`), ...asArray(document.final_deliverables).map((item) => `Entregable: ${asText(item)}`)]],
    ['Seguridad y condiciones para proveedores', [...asArray(document.safety_requirements).map((item) => `Seguridad: ${asText(item)}`), ...asArray(document.supplier_conditions).map((item) => `Condicion: ${asText(item)}`)]],
    ['Estructura de informe y anexos', [...asArray(document.final_report_structure).map((item) => `Informe: ${asText(item)}`), ...asArray(document.suggested_annexes).map((item) => `Anexo: ${asText(item)}`)]],
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
  addPptTitle(slide, 'Requisitos y condiciones de licitacion');
  addPptRows(slide, [
    ...termsListRows(asArray(bases.minimum_supplier_requirements), 'Requisito'),
    ...termsListRows(asArray(bases.requested_documentation), 'Documentacion'),
    ...termsListRows(asArray(bases.proposal_submission_conditions), 'Condicion'),
    ...termsListRows(asArray(bases.award_criteria), 'Criterio'),
    ...termsListRows(asArray(bases.disqualification_conditions), 'Descalificacion'),
    ...termsListRows(asArray(bases.buyer_observations), 'Observacion'),
  ], { maxRows: 12 });
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

  slide = pptx.addSlide();
  addPptTitle(slide, 'Faltantes y recomendaciones');
  addPptRows(slide, [
    ...termsListRows(asArray(result.missing_information), 'Informacion faltante'),
    ...termsListRows(asArray(result.buyer_recommendations), 'Recomendacion'),
  ], { maxRows: 12 });
  addPptFooter(slide, input);

  const supportDocs = asArray(result.supporting_documents_summary).map(asRecord);
  if (supportDocs.length) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Documentos de apoyo leidos');
    addPptRows(slide, supportDocs.map((item) => ({
      Archivo: item.file_name ?? item.name,
      Tipo: item.detected_type ?? item.type,
      Hallazgos: asArray(item.relevant_findings).map(asText).join('; '),
      Limitaciones: asArray(item.limitations).map(asText).join('; '),
    })), { maxRows: 8 });
    addPptFooter(slide, input);
  }

  await pptx.writeFile({ fileName: getDefaultFileName(input, 'pptx') });
}

async function downloadDashboardResultPptx(input: AgentExportInput, result: Record<string, unknown>) {
  result = buildPublicDashboardResult(result);
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
  slide.addText(dashboardBusinessText(asRecord(result.executiveSummary).information_found, asText(result.executive_summary)), { x: 0.6, y: 2.15, w: 11.7, h: 1.25, fontSize: 14, color: '334155', fit: 'shrink' });
  slide.addText(`Audiencia: ${asText(result.audience)}\nPeriodo: ${asText(result.period)}\nTipo de datos: ${asText(result.data_type)}`, {
    x: 0.65,
    y: 3.85,
    w: 5.2,
    h: 1.1,
    fontSize: 12,
    color: '475569',
    fit: 'shrink',
  });
  addPptFooter(slide, input);

  const kpis = dashboardBusinessKpis(result);
  if (kpis.length) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'KPIs principales', 'Indicadores de negocio del mismo dashboard visible en plataforma.');
    addPptKpiCards(slide, kpis);
    addPptFooter(slide, input);
  }

  const charts = asArray(result.charts).map(asRecord);
  if (charts.length) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Graficos principales', 'Visualizaciones ejecutivas generadas desde el dashboard.');
    charts.slice(0, 2).forEach((chart, index) => {
      const x = index === 0 ? 0.6 : 6.8;
      slide.addText(asText(chart.title, 'Grafico'), { x, y: 1.28, w: 5.7, h: 0.25, fontSize: 12, bold: true, color: '09008B', fit: 'shrink' });
      slide.addText(dashboardBusinessText(chart.description), { x, y: 1.58, w: 5.7, h: 0.34, fontSize: 8, color: '64748B', fit: 'shrink' });
      addPptChartVisual(slide, chart, { x, y: 2.05, w: 5.7, h: 3.2 });
      slide.addText(dashboardBusinessText(chart.insight), { x, y: 5.88, w: 5.7, h: 0.42, fontSize: 8, color: '334155', fit: 'shrink' });
    });
    addPptFooter(slide, input);
  }

  charts.slice(2, 5).forEach((chart) => {
    slide = pptx.addSlide();
    addPptTitle(slide, asText(chart.title, 'Grafico'), dashboardBusinessText(chart.description));
    addPptChartVisual(slide, chart, { x: 0.75, y: 1.45, w: 7.8, h: 4.7 });
    slide.addText(dashboardBusinessText(chart.insight), { x: 8.85, y: 1.6, w: 3.7, h: 1.2, fontSize: 12, color: '334155', fit: 'shrink' });
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

  const findings = asArray(result.findings).map(asRecord);
  if (findings.length) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Hallazgos con evidencia');
    addPptRows(slide, findings.map((item) => ({
      Hallazgo: dashboardBusinessText(item.title),
      Descripcion: dashboardBusinessText(item.description),
    })), { maxRows: 8 });
    addPptFooter(slide, input);
  }

  slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
  addPptTitle(slide, 'Disclaimer');
  slide.addText(DASHBOARD_CREATOR_DISCLAIMER, {
    x: 0.7,
    y: 1.45,
    w: 11.5,
    h: 1.1,
    fontSize: 12,
    color: '334155',
    fit: 'shrink',
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
  const model = tcoPresentationModel(result);
  let slide = pptx.addSlide();
  addPptTitle(slide, asText(result.analysis_title, input.title));
  slide.addText(asText(summary.final_recommendation || summary.why_it_wins), { x: 0.65, y: 1.45, w: 11.8, h: 1.25, fontSize: 14, color: '334155', fit: 'shrink' });
  slide.addText(`Producto: ${asText(result.item_name)}\nHorizonte: ${asText(result.evaluation_horizon)}\nMoneda: ${asText(result.currency)}\nMejor alternativa: ${asText(summary.best_alternative)}\nCalificacion: ${asText(summary.best_alternative_score)} / 100 - ${asText(summary.best_alternative_score_label)}`, {
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

  slide = pptx.addSlide();
  addPptTitle(slide, 'KPIs ejecutivos');
  addPptRows(slide, tcoKpiRows(model), { maxRows: 8 });
  addPptFooter(slide, input);

  [
    ['Matriz TCO resumida', renderTcoMatrixForPptRows(model).slice(0, 12)],
    ['Scorecard', tcoScorecardRows(model).slice(0, 12)],
    ['Ranking gerencial', (tcoScorecardTotalRows(model).length ? tcoScorecardTotalRows(model) : tcoRankingRows(result)).slice(0, 5)],
    ['Riesgos principales', tcoRiskRows(result).slice(0, 8)],
  ].forEach(([title, rows]) => {
    slide = pptx.addSlide();
    addPptTitle(slide, String(title));
    addPptRows(slide, rows as Array<Record<string, unknown>>, { maxRows: (rows as Array<Record<string, unknown>>).length });
    addPptFooter(slide, input);
  });

  slide = pptx.addSlide();
  addPptTitle(slide, 'Datos faltantes y supuestos criticos');
  slide.addText([
    'Datos faltantes:',
    ...model.missingData.slice(0, 6).map((item) => `- ${asText(item)}`),
    '',
    'Benchmarks / supuestos:',
    ...tcoBenchmarkRows(model).slice(0, 5).map((item) => `- ${asText(item.Campo)}: ${asText(item.Valor)} (${asText(item.Confianza)})`),
  ].join('\n'), { x: 0.65, y: 1.3, w: 11.8, h: 5.4, fontSize: 11, color: '334155', fit: 'shrink', breakLine: false });
  addPptFooter(slide, input);

  slide = pptx.addSlide();
  addPptTitle(slide, 'Recomendacion estrategica');
  slide.addText([
    `Accion recomendada: ${asText(recommendation.recommended_action)}`,
    `Mejor opcion economica: ${asText(recommendation.economic_option)}`,
    `Mejor opcion tecnica: ${asText(recommendation.technical_option)}`,
    `Mejor opcion por menor riesgo: ${asText(recommendation.lowest_risk_option)}`,
    `Mejor opcion balanceada: ${asText(recommendation.balanced_option)}`,
    `Opcion recomendada final: ${asText(recommendation.final_recommended_option)}`,
    `Justificacion: ${asText(recommendation.recommendation_rationale)}`,
    '',
    'Puntos de negociacion:',
    ...asArray(recommendation.negotiation_points).slice(0, 4).map((item) => `- ${asText(item)}`),
    '',
    'Siguientes pasos:',
    ...asArray(recommendation.next_steps).slice(0, 5).map((item) => `- ${asText(item)}`),
  ].join('\n'), { x: 0.65, y: 1.3, w: 11.8, h: 5.4, fontSize: 12, color: '334155', fit: 'shrink', breakLine: false });
  addPptFooter(slide, input);

  slide = pptx.addSlide();
  addPptTitle(slide, 'Conclusion');
  slide.addText(asText(recommendation.recommendation_rationale || summary.final_recommendation), {
    x: 0.65,
    y: 1.4,
    w: 11.8,
    h: 4.4,
    fontSize: 16,
    color: '334155',
    fit: 'shrink',
  });
  addPptFooter(slide, input);

  await pptx.writeFile({ fileName: getDefaultFileName(input, 'pptx') });
}

async function downloadProposalComparisonPptx(input: AgentExportInput, result: Record<string, unknown>) {
  const pptxgen = (await import('pptxgenjs')).default;
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Buyer Nodus';
  pptx.subject = input.agentName || input.title;
  pptx.title = asText(result.analysis_title, input.title);
  pptx.company = getBrandName(input.pdfMode ?? 'standard_branded', input.pdfOptions) || 'Buyer Nodus';
  pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'es-PE' };

  const recommendedName = asText(result.recommended_supplier || getRecommendedRanking(result).supplier_name, 'No especificado');
  let slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
  slide.addText(getBrandName(input.pdfMode ?? 'standard_branded', input.pdfOptions) || 'BUYER NODUS', { x: 0.55, y: 0.35, w: 6, h: 0.25, fontSize: 9, bold: true, color: '6B63D9' });
  slide.addText(asText(result.analysis_title, input.title), { x: 0.55, y: 1.0, w: 11.9, h: 0.85, fontSize: 29, bold: true, color: '09008B', fit: 'shrink' });
  slide.addText(asText(result.executive_summary), { x: 0.6, y: 2.15, w: 11.7, h: 1.25, fontSize: 14, color: '334155', fit: 'shrink' });
  slide.addText(`Servicio evaluado: ${asText(result.service, 'No especificado')}\nObjetivo: ${asText(result.objective, 'No especificado')}\nProveedor recomendado: ${recommendedName}`, {
    x: 0.65,
    y: 3.85,
    w: 11.6,
    h: 1.15,
    fontSize: 12,
    color: '475569',
    fit: 'shrink',
  });
  addPptFooter(slide, input);

  const executiveRows = proposalExecutiveRows(result);
  if (executiveRows.length) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Resumen ejecutivo comparativo', 'Mismo resumen visible en la plataforma.');
    addPptProposalTable(slide, executiveRows, { maxRows: executiveRows.length, fontSize: 7.2 });
    addPptFooter(slide, input);
  }

  const matrixRows = proposalMatrixRows(result);
  if (matrixRows.length) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Matriz de evaluación comparativa', asText(result.auto_generated_criteria_note));
    addPptProposalTable(slide, matrixRows, { maxRows: Math.min(matrixRows.length, 8), fontSize: 6.2 });
    addPptFooter(slide, input);
  }

  const weightedRows = proposalWeightedRows(result);
  const rankingRows = proposalRankingRows(result);
  slide = pptx.addSlide();
  addPptTitle(slide, 'Ranking y puntaje ponderado total');
  if (weightedRows.length) addPptProposalTable(slide, weightedRows, { x: 0.55, y: 1.25, w: 5.7, h: 2.25, maxRows: weightedRows.length, fontSize: 8 });
  if (rankingRows.length) addPptProposalTable(slide, rankingRows, { x: 6.55, y: 1.25, w: 6.15, h: 5.3, maxRows: Math.min(rankingRows.length, 6), fontSize: 7.2 });
  addPptFooter(slide, input);

  const criteriaRows = proposalCriteriaGuideRows(result);
  if (criteriaRows.length) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Guia de criterios', 'Escala de valoracion y fuente de verificacion.');
    addPptProposalTable(slide, criteriaRows, { maxRows: Math.min(criteriaRows.length, 7), fontSize: 6.3 });
    addPptFooter(slide, input);
  }

  const comparisonRows = proposalComparisonRows(result);
  if (comparisonRows.length) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Tabla comparativa', 'Misma tabla comparativa visible en la plataforma.');
    addPptProposalTable(slide, comparisonRows, { maxRows: Math.min(comparisonRows.length, 8), fontSize: 6.2 });
    addPptFooter(slide, input);
  }

  slide = pptx.addSlide();
  addPptTitle(slide, 'Riesgos, información faltante y preguntas sugeridas');
  const riskText = proposalListRows(asArray(result.global_risks), 'Riesgo').map((row) => `- ${asText(row.Riesgo)}`).join('\n') || 'Sin riesgos globales registrados.';
  const missingText = proposalListRows(asArray(result.missing_information), 'Informacion').map((row) => `- ${asText(row.Informacion)}`).join('\n') || 'Sin informacion faltante registrada.';
  const questionsText = proposalListRows(asArray(result.questions_for_suppliers), 'Pregunta').map((row) => `- ${asText(row.Pregunta)}`).join('\n') || 'Sin preguntas sugeridas registradas.';
  slide.addText('Riesgos globales', { x: 0.65, y: 1.35, w: 3.6, h: 0.28, fontSize: 11, bold: true, color: '09008B' });
  slide.addText(riskText, { x: 0.65, y: 1.75, w: 3.6, h: 4.65, fontSize: 8.5, color: '334155', fit: 'shrink', breakLine: false });
  slide.addText('Información faltante', { x: 4.65, y: 1.35, w: 3.6, h: 0.28, fontSize: 11, bold: true, color: '09008B' });
  slide.addText(missingText, { x: 4.65, y: 1.75, w: 3.6, h: 4.65, fontSize: 8.5, color: '334155', fit: 'shrink', breakLine: false });
  slide.addText('Preguntas sugeridas', { x: 8.65, y: 1.35, w: 3.6, h: 0.28, fontSize: 11, bold: true, color: '09008B' });
  slide.addText(questionsText, { x: 8.65, y: 1.75, w: 3.6, h: 4.65, fontSize: 8.5, color: '334155', fit: 'shrink', breakLine: false });
  addPptFooter(slide, input);

  slide = pptx.addSlide();
  addPptTitle(slide, 'Recomendación final', `Proveedor recomendado: ${recommendedName}`);
  slide.addShape('roundRect', { x: 0.7, y: 1.35, w: 11.75, h: 3.5, fill: { color: 'ECFDF5' }, line: { color: 'A7F3D0', pt: 1 }, radius: 0.12 });
  slide.addText(asText(result.final_recommendation), { x: 1.0, y: 1.75, w: 11.15, h: 2.55, fontSize: 16, color: '064E3B', fit: 'shrink' });
  slide.addText(asText(result.disclaimer), { x: 0.7, y: 5.35, w: 11.75, h: 0.75, fontSize: 9, color: '64748B', fit: 'shrink' });
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
  if (isProposalComparison(result)) {
    await downloadProposalComparisonPptx(input, result);
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
  if (isTermsOfReferenceResult(input.result)) {
    addTermsOfReferencePdf(input);
    return;
  }
  if (isTcoAnalysisResult(input.result)) {
    addTcoAnalysisPdf(input);
    return;
  }
  if (isDashboardResult(input.result)) {
    addDashboardResultPdf(input);
    return;
  }
  if (isProposalComparison(input.result)) {
    addProposalComparisonPdf(input);
    return;
  }
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

