import jsPDF from 'jspdf';
import type { AgentPdfMode, AgentPdfOptions } from '@/types';
import {
  flattenTcoMatrixRows,
  normalizeTcoForPresentation,
  tcoKpiRows,
  type TcoPresentationModel,
} from '@/features/tco-analysis/tcoPresentation';
import type { TcoAnalysisResult } from '@/features/tco-analysis/tcoAnalysisApi';
import {
  assertDeliverableCanDownload,
  auditDeliverableBeforeDownload,
} from '@/lib/deliverableQuality';
import {
  blockLabel,
  buildExportPayload,
  buyerNodusExportTheme,
  cleanExportBlocks,
  isExportPayload,
  type ExportBlock,
  type ExportFormat,
  type ExportPayload,
} from '@/lib/exports';

const DASHBOARD_CREATOR_DISCLAIMER =
  'Este dashboard de compras fue generado con asistencia de IA a partir de los archivos cargados por el usuario. La información, indicadores y recomendaciones deben ser revisados y validados por el comprador antes de tomar decisiones finales.';

export type AgentExportFormat = 'pdf' | 'docx' | 'pptx' | 'xlsx';
type TermsExportScopeCode = 'PACKAGE' | 'TDR-01' | 'BC-01' | 'INV-03' | 'CRO-04' | 'PEN-05';
export type TermsExportScope = {
  documentCode: TermsExportScopeCode;
  documentTitle: string;
  sections: string[];
  hasPendingWarnings?: boolean;
  processCode?: string;
};
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
  agentKey?: string;
  termsScope?: TermsExportScope;
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
  const scopedInput = input as PdfInput & { termsScope?: TermsExportScope };
  if (scopedInput.termsScope || isTermsOfReferenceResult(input.result)) {
    const result = asRecord(input.result);
    const processCode = asText(scopedInput.termsScope?.processCode ?? result.process_code, '')
      .replace(/\.[a-z0-9]+$/i, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 70) || 'COMPLETAR_codigo_del_proceso';
    const scope = scopedInput.termsScope;
    const prefix = scope?.documentCode && scope.documentCode !== 'PACKAGE'
      ? `${scope.documentCode}_${scope.documentTitle}`
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
      : extension === 'pdf'
        ? 'BuyerNodus_Paquete_Contratacion'
        : extension === 'xlsx'
          ? 'BuyerNodus_Matrices_Cronograma'
          : extension === 'pptx'
            ? 'BuyerNodus_Resumen_Comite'
            : 'BuyerNodus_Documentos_Contratacion';
    return `${prefix}_${processCode}.${extension}`;
  }
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

function termsGeneratedDocuments(result: Record<string, unknown>) {
  const docs = asArray(result.generated_documents).map((item) => asText(item, '')).filter(Boolean);
  return docs.length ? docs : ['TDR', 'Bases del Concurso', 'Invitacion a postores', 'Cronograma'];
}

function normalizeTermsDocumentName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function termsHasDocument(result: Record<string, unknown>, name: 'tdr' | 'bases' | 'invitacion' | 'cronograma') {
  const docs = termsGeneratedDocuments(result).map(normalizeTermsDocumentName);
  if (name === 'tdr') return docs.some((item) => item.includes('tdr') || item.includes('termino'));
  if (name === 'bases') return docs.some((item) => item.includes('bases') || item.includes('concurso'));
  if (name === 'invitacion') return docs.some((item) => item.includes('invitacion') || item.includes('correo') || item.includes('postor'));
  return docs.some((item) => item.includes('cronograma') || item.includes('calendario'));
}

function getTermsContractingEntity(result: Record<string, unknown>) {
  return asRecord(result.contracting_entity);
}

function getTermsKeyValueRows(result: Record<string, unknown>) {
  const document = getTermsDocument(result);
  const general = getTermsGeneralData(result);
  const bases = getTermsTenderBases(result);
  const entity = getTermsContractingEntity(result);
  return [
    { Campo: 'Nombre del proceso', Valor: general.requirement_name ?? result.title },
    { Campo: 'Codigo del proceso', Valor: result.process_code },
    { Campo: 'Documentos generados', Valor: termsGeneratedDocuments(result).join(', ') },
    { Campo: 'Tipo de contratacion identificado', Valor: document.tdr_type ?? result.requirement_type },
    { Campo: 'Entidad convocante', Valor: entity.business_name ?? entity.legal_name ?? entity.name ?? '[COMPLETAR: entidad convocante]' },
    { Campo: 'Area solicitante', Valor: entity.requesting_area ?? general.category ?? result.category },
    { Campo: 'Modalidad', Valor: bases.modality ?? bases.process_type ?? result.document_request ?? '[SUGERIDO] Concurso privado' },
    { Campo: 'Presupuesto referencial', Valor: bases.reference_budget ?? document.reference_budget ?? '[COMPLETAR: presupuesto referencial]' },
    { Campo: 'Plazo de ejecucion', Valor: general.required_date ?? bases.execution_term ?? '[SUGERIDO: confirmar plazo]' },
    { Campo: 'Fecha limite de propuestas', Valor: bases.proposal_deadline ?? '[SUGERIDO: definir en cronograma]' },
    { Campo: 'Puntaje tecnico/economico', Valor: asArray(document.evaluation_matrix).length ? 'Matriz de 100 puntos' : '[SUGERIDO: validar ponderacion]' },
    { Campo: 'Nivel de riesgo', Valor: result.risk_level },
  ];
}

function getTermsDashboardKpis(result: Record<string, unknown>) {
  const document = getTermsDocument(result);
  const bases = getTermsTenderBases(result);
  const bidderCount = asArray(result.invited_bidders).length;
  const pendingCount = asArray(result.missing_information).length + getTermsPendingRows(result).filter((row) => row.Tipo === '[COMPLETAR]').length;
  const scoreTotal = asArray(document.evaluation_matrix).map(asRecord).reduce((sum, item) => sum + (Number(item.score) || 0), 0);
  return [
    { title: 'Tipo de contratacion', value: asText(document.tdr_type ?? result.requirement_type), description: 'Clasificacion usada para adaptar documentos.' },
    { title: 'Presupuesto', value: asText(bases.reference_budget ?? document.reference_budget, '[COMPLETAR]'), description: 'Monto referencial informado o pendiente.' },
    { title: 'Plazo', value: asText(getTermsGeneralData(result).required_date ?? bases.execution_term, '[SUGERIDO]'), description: 'Plazo visible en el paquete.' },
    { title: 'Documentos', value: String(termsGeneratedDocuments(result).length), description: termsGeneratedDocuments(result).join(', ') },
    { title: 'Postores', value: bidderCount ? String(bidderCount) : '[COMPLETAR]', description: 'Empresas o contactos invitados.' },
    { title: 'Limite propuestas', value: asText(bases.proposal_deadline, '[SUGERIDO]'), description: 'Fecha o hito para recepcion.' },
    { title: 'Evaluacion', value: scoreTotal ? `${scoreTotal} pts` : '[SUGERIDO]', description: 'La matriz debe sumar 100 puntos.' },
    { title: 'Pendientes', value: String(pendingCount), description: 'Datos por completar o confirmar.' },
  ];
}

function getTermsEvaluationRows(result: Record<string, unknown>) {
  const document = getTermsDocument(result);
  const matrix = asArray(document.evaluation_matrix).map(asRecord).map((item) => ({
    Criterio: item.criterion,
    Subcriterio: item.subcriterion,
    'Puntaje maximo': item.score,
    'Evidencia requerida': item.required_evidence,
    Tipo: item.type ?? 'Tecnico/Economico',
    Observaciones: item.observations ?? '',
  }));
  if (matrix.length) return matrix;
  return termsListRows(asArray(document.evaluation_criteria).length ? asArray(document.evaluation_criteria) : asArray(getTermsTenderBases(result).evaluation_criteria), 'Criterio')
    .map((item) => ({ ...item, 'Puntaje maximo': '[SUGERIDO]', 'Evidencia requerida': '[COMPLETAR]' }));
}

function getTermsComplianceRows(result: Record<string, unknown>) {
  return asArray(getTermsDocument(result).compliance_matrix).map(asRecord).map((item) => ({
    Requisito: item.requirement,
    Tipo: item.type,
    'Obligatorio/Deseable': item.mandatory,
    'Evidencia requerida': item.expected_evidence,
    Estado: item.status,
    Comentario: item.comment ?? item.observations ?? '',
  }));
}

function getTermsRequiredDocumentRows(result: Record<string, unknown>) {
  const document = getTermsDocument(result);
  const bases = getTermsTenderBases(result);
  const docs = asArray(document.required_documents).length ? asArray(document.required_documents) : asArray(bases.requested_documentation);
  return docs.map((item, index) => ({
    Codigo: `DOC-${String(index + 1).padStart(2, '0')}`,
    Documento: asText(item),
    'Responsable de entrega': 'Postor',
    'Obligatorio/Deseable': index < 5 ? 'Obligatorio' : 'Deseable',
    Etapa: 'Presentacion de propuesta',
    Observaciones: '',
  }));
}

function getTermsGuaranteeRows(result: Record<string, unknown>) {
  return asArray(getTermsDocument(result).guarantees_penalties).map(asRecord).map((item) => ({
    Tipo: item.type ?? item.item,
    'Porcentaje/Monto': item.amount ?? item.percentage ?? '[SUGERIDO]',
    Vigencia: item.validity ?? '[SUGERIDO]',
    'Momento de entrega': item.delivery_moment ?? '[SUGERIDO]',
    'Condicion de ejecucion': item.condition,
    Observaciones: item.status ?? '',
  }));
}

function getTermsRiskRows(result: Record<string, unknown>) {
  return asArray(getTermsDocument(result).identified_risks).map(asRecord).map((item) => ({
    Riesgo: item.risk,
    Impacto: item.impact,
    Probabilidad: item.probability ?? '[SUGERIDO]',
    Nivel: item.level ?? item.impact,
    Mitigacion: item.mitigation,
    Responsable: item.responsible ?? '[COMPLETAR]',
  }));
}

function getTermsScheduleRows(result: Record<string, unknown>) {
  const rows = asArray(result.process_schedule).map(asRecord);
  if (rows.length) {
    return rows.map((item, index) => ({
      Fase: item.phase,
      N: item.number ?? index + 1,
      'Actividad/Hito': item.activity,
      Responsable: item.responsible,
      'Fecha inicio': item.start,
      'Fecha fin': item.end,
      Duracion: item.duration,
      Entregable: item.deliverable,
      Observaciones: item.observations,
      Estado: asText(item.start, '').includes('[COMPLETAR]') ? '[COMPLETAR]' : 'Referencial',
    }));
  }
  return termsListRows(asArray(result.tender_process), 'Actividad/Hito').map((item) => ({
    Fase: 'Proceso de seleccion',
    ...item,
    Responsable: '[COMPLETAR]',
    'Fecha inicio': '[SUGERIDO]',
    'Fecha fin': '[SUGERIDO]',
    Duracion: '[SUGERIDO]',
    Entregable: 'Hito del proceso',
    Observaciones: '',
    Estado: 'Referencial',
  }));
}

function getTermsTdrRows(result: Record<string, unknown>) {
  const document = getTermsDocument(result);
  const general = getTermsGeneralData(result);
  const sections: Array<[string, string, unknown, string?]> = [
    ['Encabezado', 'Nombre del proceso', general.requirement_name ?? result.title],
    ['Generalidades', 'Tipo y categoria', `${asText(general.requirement_type ?? result.requirement_type)} | ${asText(general.category ?? result.category)}`],
    ['Antecedentes y justificacion', 'Antecedentes', document.background],
    ['Antecedentes y justificacion', 'Justificacion', document.justification],
    ['Objeto y alcance', 'Objetivo', document.objective],
    ['Objeto y alcance', 'Alcance', document.scope],
    ['Documentos y normas tecnicas', 'Documentacion requerida', asArray(document.required_documents).join(' | ')],
    ['Documentos y normas tecnicas', 'Normas o marco aplicable', asArray(document.applicable_standards).join(' | ')],
    ['Especificaciones tecnicas minimas', 'Caracteristicas tecnicas', asArray(document.technical_characteristics).join(' | ')],
    ['Plazo de ejecucion y cronograma', 'Cronograma sugerido', asArray(document.suggested_schedule).join(' | ')],
    ['Presupuesto y condiciones de pago', 'Condiciones comerciales', asArray(document.commercial_conditions).join(' | ')],
    ['Requisitos de habilitacion', 'Condiciones para proveedores', asArray(document.supplier_conditions).join(' | ')],
    ['Contenido de la propuesta', 'Criterios de evaluacion', asArray(document.evaluation_criteria).join(' | ')],
    ['Supervision y control de calidad', 'Condiciones de ejecucion', asArray(document.execution_conditions).join(' | ')],
    ['Seguridad, salud y medio ambiente', 'Requisitos de seguridad', asArray(document.safety_requirements).join(' | ')],
    ['Recepcion, garantia y penalidades', 'Garantias y penalidades', getTermsGuaranteeRows(result).map((item) => `${asText(item.Tipo)}: ${asText(item['Condicion de ejecucion'])}`).join(' | ')],
    ['Disposiciones finales', 'Anexos sugeridos', asArray(document.suggested_annexes).join(' | ')],
    ['Aprobacion y firmas', 'Firmas', '[COMPLETAR: responsables de aprobacion]'],
  ];
  return sections.map(([section, subsection, content, observations]) => ({
    Seccion: section,
    Subseccion: subsection,
    Contenido: asText(content),
    Observaciones: observations ?? '',
  }));
}

function getTermsBasesRows(result: Record<string, unknown>) {
  const bases = getTermsTenderBases(result);
  return [
    ['CAPITULO I - Disposiciones generales', 'Objeto del proceso', bases.object],
    ['CAPITULO I - Disposiciones generales', 'Entidad convocante y modalidad', `${asText(getTermsContractingEntity(result).business_name ?? '[COMPLETAR: entidad convocante]')} | ${asText(bases.modality ?? '[SUGERIDO] Concurso privado')}`],
    ['CAPITULO I - Disposiciones generales', 'Presupuesto, moneda y presentacion', asText(bases.reference_budget ?? '[COMPLETAR: presupuesto referencial]')],
    ['CAPITULO II - Participantes y requisitos', 'Requisitos minimos del proveedor', asArray(bases.minimum_supplier_requirements).join(' | ')],
    ['CAPITULO III - Contenido de la propuesta', 'Documentacion solicitada', asArray(bases.requested_documentation).join(' | ')],
    ['CAPITULO III - Contenido de la propuesta', 'Condiciones de presentacion', asArray(bases.proposal_submission_conditions).join(' | ')],
    ['CAPITULO IV - Garantias y seguros', 'Garantias y penalidades', getTermsGuaranteeRows(result).map((item) => `${asText(item.Tipo)}: ${asText(item['Condicion de ejecucion'])}`).join(' | ')],
    ['CAPITULO V - Proceso de seleccion', 'Cronograma y etapas', getTermsScheduleRows(result).map((item) => `${asText(item.N)}. ${asText(item['Actividad/Hito'])}`).join(' | ')],
    ['CAPITULO VI - Criterios de evaluacion', 'Matriz de evaluacion', getTermsEvaluationRows(result).map((item) => `${asText(item.Criterio)} (${asText(item['Puntaje maximo'])})`).join(' | ')],
    ['CAPITULO VI - Criterios de evaluacion', 'Criterios de adjudicacion', asArray(bases.award_criteria).join(' | ')],
    ['Disposiciones finales', 'Descalificacion y observaciones', [...asArray(bases.disqualification_conditions), ...asArray(bases.buyer_observations)].join(' | ')],
  ].map(([chapter, numeral, content]) => ({ Capitulo: chapter, Numeral: numeral, Contenido: asText(content), Observaciones: '' }));
}

function getTermsInvitationRows(result: Record<string, unknown>) {
  const email = getTermsEmail(result);
  return [
    { Seccion: 'Destinatario', Contenido: '[COMPLETAR: ingresar empresas invitadas]', 'Variable editable': '{razon_social}', Observaciones: '' },
    { Seccion: 'Asunto', Contenido: email.subject, 'Variable editable': '', Observaciones: '' },
    { Seccion: 'Referencia', Contenido: `Proceso ${asText(result.process_code)} - ${asText(result.title)}`, 'Variable editable': '', Observaciones: '' },
    { Seccion: 'Saludo', Contenido: email.greeting, 'Variable editable': '{nombre_contacto}', Observaciones: '' },
    { Seccion: 'Presentacion del proceso', Contenido: email.body, 'Variable editable': '', Observaciones: '' },
    { Seccion: 'Documentos adjuntos', Contenido: asArray(email.attached_documents).join(', '), 'Variable editable': '', Observaciones: '' },
    { Seccion: 'Fechas clave', Contenido: `Plazo: ${asText(email.response_deadline)} | Consultas: ${asText(getTermsTenderBases(result).question_deadline)} | Propuestas: ${asText(getTermsTenderBases(result).proposal_deadline)}`, 'Variable editable': '', Observaciones: '' },
    { Seccion: 'Contacto', Contenido: email.contact_details, 'Variable editable': '', Observaciones: '' },
    { Seccion: 'Cierre y firma', Contenido: email.closing, 'Variable editable': '{responsable_proceso}', Observaciones: '' },
  ];
}

function getTermsPendingRows(result: Record<string, unknown>) {
  const rows: Array<Record<string, unknown>> = [];
  const addPending = (value: unknown, documentName: string) => {
    const text = asText(value, '');
    if (!text) return;
    const matches = text.match(/\[(COMPLETAR|SUGERIDO)[^\]]*\][^|;\n.]*/gi);
    matches?.forEach((match) => {
      const type = normalizeTermsDocumentName(match).includes('completar') ? '[COMPLETAR]' : '[SUGERIDO]';
      rows.push({
        'Campo pendiente': match.trim(),
        Tipo: type,
        Urgencia: type === '[COMPLETAR]' ? 'Alta' : 'Media',
        'Documento afectado': documentName,
        'Accion requerida': type === '[COMPLETAR]' ? 'Completar antes de enviar el paquete.' : 'Confirmar o ajustar la sugerencia.',
      });
    });
  };
  asArray(result.missing_information).forEach((item) => addPending(item, 'Paquete'));
  getTermsTdrRows(result).forEach((row) => addPending(row.Contenido, 'TDR'));
  getTermsBasesRows(result).forEach((row) => addPending(row.Contenido, 'Bases'));
  getTermsInvitationRows(result).forEach((row) => addPending(row.Contenido, 'Invitacion'));
  getTermsScheduleRows(result).forEach((row) => Object.values(row).forEach((value) => addPending(value, 'Cronograma')));
  return rows.length ? rows : [{ 'Campo pendiente': 'Sin pendientes criticos detectados', Tipo: 'OK', Urgencia: 'Baja', 'Documento afectado': 'Paquete', 'Accion requerida': 'Revisar internamente antes de enviar.' }];
}

function getTermsScope(input: PdfInput | AgentExportInput): TermsExportScope {
  const scope = (input as AgentExportInput).termsScope;
  return scope ?? {
    documentCode: 'PACKAGE',
    documentTitle: 'Paquete de Contratacion',
    sections: ['tdr', 'matrizRiesgos', 'calidad', 'bases', 'invitacion', 'cronograma', 'pendientes'],
  };
}

function termsScopeIncludes(scope: TermsExportScope, section: string) {
  return scope.documentCode === 'PACKAGE' || scope.sections.includes(section);
}

function termsScopeTitle(scope: TermsExportScope) {
  return scope.documentCode === 'PACKAGE' ? 'Paquete de documentos de contratacion' : `${scope.documentCode} - ${scope.documentTitle}`;
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
  const scope = getTermsScope(input);
  const document = getTermsDocument(result);
  const general = getTermsGeneralData(result);
  const bases = getTermsTenderBases(result);
  const email = getTermsEmail(result);
  const generatedDocs = termsGeneratedDocuments(result);
  const subtitle = `Tipo: ${asText(document.tdr_type ?? result.requirement_type)} | Categoria: ${asText(result.category)} | Riesgo: ${asText(result.risk_level)}`;

  addHeader(ctx, input, subtitle);
  addCard(ctx, 'Portada ejecutiva', [
    `${getBrandName(ctx.mode, ctx.options) || 'Buyer Nodus'} | ${termsScopeTitle(scope)}`,
    `Proceso: ${asText(general.requirement_name ?? result.title)}`,
    `Codigo: ${asText(result.process_code)}`,
    `Entidad convocante: ${asText(getTermsContractingEntity(result).business_name ?? getTermsContractingEntity(result).legal_name, '[COMPLETAR: entidad convocante]')}`,
    `Version del documento: ${formatDate()}`,
  ], 'blue');

  addCard(ctx, 'Resumen ejecutivo', [
    asText(result.executive_summary),
    `Documentos generados: ${generatedDocs.join(', ')}`,
    `Codigo de proceso: ${asText(result.process_code)}`,
    `Presupuesto referencial: ${asText(bases.reference_budget ?? document.reference_budget, '[COMPLETAR: presupuesto referencial]')}`,
    `Fecha limite de propuestas: ${asText(bases.proposal_deadline, '[SUGERIDO: definir fecha limite]')}`,
    `Completitud: ${asText(result.completion_level)} (${asText(result.completion_score)}%)`,
    `Ubicacion: ${asText(general.location)} | Fecha requerida: ${asText(general.required_date)}`,
  ]);

  if (scope.hasPendingWarnings) {
    addCard(ctx, 'Advertencia de datos pendientes', 'Este documento contiene datos pendientes de completar.', 'amber');
  }

  if (scope.documentCode === 'PACKAGE') {
    addSection(ctx, 'Indice del paquete');
    addTable(
      ctx,
      ['Codigo', 'Documento', 'Estado'],
      [
        ['DOC-01', 'Terminos de Referencia', termsHasDocument(result, 'tdr') ? 'Generado' : 'No solicitado'],
        ['DOC-02', 'Bases del Concurso', termsHasDocument(result, 'bases') ? 'Generado' : 'No solicitado'],
        ['DOC-03', 'Invitacion a Postores', termsHasDocument(result, 'invitacion') ? 'Generado' : 'No solicitado'],
        ['DOC-04', 'Cronograma del Proceso', termsHasDocument(result, 'cronograma') ? 'Generado' : 'No solicitado'],
        ['DOC-05', 'Pendientes y recomendaciones', 'Incluido'],
      ],
      [28, ctx.maxWidth - 70, 42],
    );
  }

  addDashboardKpiCards(ctx, getTermsDashboardKpis(result));

  if (termsScopeIncludes(scope, 'tdr')) {
    addSection(ctx, 'DOC-01 - Terminos de Referencia completo');
  addTable(
    ctx,
    ['Campo', 'Contenido'],
    [
      ['Nombre', general.requirement_name ?? result.title],
      ['Tipo de TDR identificado', document.tdr_type],
      ['Tipo', general.requirement_type ?? result.requirement_type],
      ['Categoria', general.category ?? result.category],
      ['Ubicacion', general.location],
      ['Fecha requerida', general.required_date],
      ['Antecedentes', document.background],
      ['Objetivo', document.objective],
      ['Alcance', document.scope],
      ['Justificacion', document.justification],
    ],
    [42, ctx.maxWidth - 42],
  );
    addTable(
      ctx,
      ['Seccion', 'Subseccion', 'Contenido'],
      getTermsTdrRows(result).map((item) => [item.Seccion, item.Subseccion, item.Contenido]),
      [42, 40, ctx.maxWidth - 82],
    );
    addBulletList(ctx, 'Caracteristicas tecnicas', asArray(document.technical_characteristics), 80);
    addBulletList(ctx, 'Actividades requeridas', asArray(document.required_activities), 80);
    addBulletList(ctx, 'Entregables finales', asArray(document.final_deliverables), 80);
    addBulletList(ctx, 'Documentacion requerida al proveedor', asArray(document.required_documents), 80);
    addBulletList(ctx, 'Normas tecnicas, estandares o marco aplicable', asArray(document.applicable_standards), 80);
    addBulletList(ctx, 'Plazo y cronograma sugerido', asArray(document.suggested_schedule), 80);
    addBulletList(ctx, 'Condiciones de ejecucion o metodologia', asArray(document.execution_conditions), 80);
    addBulletList(ctx, 'Requisitos de seguridad', asArray(document.safety_requirements), 80);
    addBulletList(ctx, 'Condiciones para proveedores', asArray(document.supplier_conditions), 80);
    addBulletList(ctx, 'Condiciones comerciales sugeridas', asArray(document.commercial_conditions), 80);
    addBulletList(ctx, 'Criterios de evaluacion', asArray(document.evaluation_criteria), 80);
    addBulletList(ctx, 'Estructura de informe final', asArray(document.final_report_structure), 80);
    addBulletList(ctx, 'Anexos sugeridos', asArray(document.suggested_annexes), 80);
  }

  if (termsScopeIncludes(scope, 'matrizRiesgos')) addSection(ctx, 'Matrices y tablas clave');
  const evaluationRows = asArray(document.evaluation_matrix).map(asRecord);
  if (termsScopeIncludes(scope, 'matrizRiesgos') && evaluationRows.length) {
    addSection(ctx, 'Matriz de evaluacion 100 puntos');
    addTable(
      ctx,
      ['Criterio', 'Subcriterio', 'Puntaje', 'Evidencia'],
      evaluationRows.map((item) => [item.criterion, item.subcriterion, item.score, item.required_evidence]),
      [42, 58, 22, ctx.maxWidth - 122],
    );
  }

  const complianceRows = asArray(document.compliance_matrix).map(asRecord);
  if (termsScopeIncludes(scope, 'matrizRiesgos') && complianceRows.length) {
    addSection(ctx, 'Matriz de cumplimiento');
    addTable(
      ctx,
      ['Requisito', 'Tipo', 'Evidencia esperada', 'Obligatorio', 'Estado'],
      complianceRows.map((item) => [item.requirement, item.type, item.expected_evidence, item.mandatory, item.status]),
      [40, 28, 56, 28, ctx.maxWidth - 152],
    );
  }

  const guaranteeRows = asArray(document.guarantees_penalties).map(asRecord);
  if (termsScopeIncludes(scope, 'matrizRiesgos') && guaranteeRows.length) {
    addSection(ctx, 'Garantias, penalidades y condiciones comerciales');
    addTable(
      ctx,
      ['Tipo', 'Condicion', 'Estado'],
      guaranteeRows.map((item) => [item.type ?? item.item, item.condition, item.status]),
      [36, ctx.maxWidth - 66, 30],
    );
  }

  const riskRows = asArray(document.identified_risks).map(asRecord);
  if (termsScopeIncludes(scope, 'matrizRiesgos') && riskRows.length) {
    addSection(ctx, 'Riesgos identificados');
    addTable(
      ctx,
      ['Riesgo', 'Impacto', 'Mitigacion'],
      riskRows.map((item) => [item.risk, item.impact, item.mitigation]),
      [60, 28, ctx.maxWidth - 88],
    );
  }

  const checklist = asArray(result.checklist).map(asRecord);
  if (termsScopeIncludes(scope, 'calidad') && checklist.length) {
    addSection(ctx, 'Checklist de calidad');
    addTable(
      ctx,
      ['Punto', 'Estado', 'Detalle'],
      checklist.map((item) => [item.label, item.status, item.detail]),
      [52, 26, ctx.maxWidth - 78],
    );
  }

  if (termsScopeIncludes(scope, 'bases')) {
    addSection(ctx, 'DOC-02 - Bases del Concurso completas');
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
    addTable(
      ctx,
      ['Capitulo', 'Numeral', 'Contenido'],
      getTermsBasesRows(result).map((item) => [item.Capitulo, item.Numeral, item.Contenido]),
      [54, 44, ctx.maxWidth - 98],
    );
  }

  if (termsScopeIncludes(scope, 'invitacion')) {
    addSection(ctx, 'DOC-03 - Invitacion a postores completa');
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
    addTable(
      ctx,
      ['Seccion', 'Contenido', 'Variable editable'],
      getTermsInvitationRows(result).map((item) => [item.Seccion, item.Contenido, item['Variable editable']]),
      [38, ctx.maxWidth - 78, 40],
    );
  }

  if (termsScopeIncludes(scope, 'cronograma')) {
    addSection(ctx, 'DOC-04 - Cronograma completo');
    addBulletList(ctx, 'Resumen de fechas clave', asArray(result.tender_process), 80);
  const scheduleRows = asArray(result.process_schedule).map(asRecord);
  if (scheduleRows.length) {
    addTable(
      ctx,
        ['N', 'Fase', 'Actividad', 'Responsable', 'Inicio', 'Fin', 'Duracion', 'Entregable', 'Observaciones'],
        scheduleRows.map((item) => [item.number, item.phase, item.activity, item.responsible, item.start, item.end, item.duration, item.deliverable, item.observations]),
        [8, 24, 34, 22, 18, 18, 16, 28, ctx.maxWidth - 168],
    );
  }
  }

  const bidderRows = asArray(result.invited_bidders).map(asRecord);
  if (bidderRows.length) {
    addSection(ctx, 'Postores invitados');
    addTable(
      ctx,
      ['Contacto', 'Empresa', 'Cargo', 'Correo'],
      bidderRows.map((item) => [item.contact_name, item.business_name, item.role, item.email]),
      [42, 50, 40, ctx.maxWidth - 132],
    );
  }

  if (termsScopeIncludes(scope, 'pendientes')) {
  addSection(ctx, 'Pendientes y recomendaciones');
  addTable(
    ctx,
    ['Campo pendiente', 'Tipo', 'Urgencia', 'Documento afectado', 'Accion requerida'],
    getTermsPendingRows(result).map((item) => [item['Campo pendiente'], item.Tipo, item.Urgencia, item['Documento afectado'], item['Accion requerida']]),
    [46, 24, 22, 36, ctx.maxWidth - 128],
  );
  addBulletList(ctx, 'Recomendaciones accionables', asArray(result.buyer_recommendations), 3);
  addBulletList(ctx, 'Preguntas recomendadas para completar el TDR', asArray(result.recommended_questions), 30);
  addBulletList(ctx, 'Validacion de consistencia', asArray(result.consistency_validation), 30);
  }

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

  if (scope.documentCode === 'PACKAGE') {
    addAdditionalResultSections(ctx, result, [
      'title',
      'requirement_type',
      'category',
      'completion_level',
      'completion_score',
      'risk_level',
      'document_request',
      'generated_documents',
      'process_code',
      'contracting_entity',
      'invited_bidders',
      'executive_summary',
      'dashboard_metrics',
      'generated_document',
      'checklist',
      'recommended_questions',
      'consistency_validation',
      'tender_bases',
      'supplier_invitation_email',
      'flow_steps',
      'process_schedule',
      'tender_process',
      'missing_information',
      'buyer_recommendations',
      'supporting_documents_summary',
      'disclaimer',
    ]);
  }
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
    rows.forEach((row) => sheet.addRow(keys.map((key) => row[key] ?? '')));
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

async function downloadTermsOfReferenceXlsx(input: AgentExportInput, result: Record<string, unknown>) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const scope = getTermsScope(input);
  workbook.creator = 'Buyer Nodus';
  workbook.created = new Date();
  workbook.modified = new Date();

  const primary = '0E109E';
  const secondary = '5A31D5';
  const amber = 'FEF3C7';
  const rose = 'FEE2E2';
  const green = 'DCFCE7';
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

  const styleWorksheet = (worksheet: import('exceljs').Worksheet, headerRow = 1) => {
    worksheet.views = [{ state: 'frozen', ySplit: headerRow, showGridLines: false }];
    styleHeader(worksheet.getRow(headerRow));
    worksheet.columns.forEach((column) => {
      let width = 14;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const text = String(cell.value ?? '');
        width = Math.max(width, Math.min(text.length + 4, 58));
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } },
        };
        if (text.includes('[COMPLETAR]') || text.includes('[COMPLETAR:')) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rose } };
          cell.font = { color: { argb: '991B1B' }, bold: true };
        } else if (text.includes('[SUGERIDO]') || text.includes('[SUGERIDO')) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: amber } };
          cell.font = { color: { argb: '92400E' } };
        }
      });
      column.width = width;
    });
    const columnCount = worksheet.columnCount || 1;
    worksheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: columnCount } };
  };

  const addRowsSheet = (name: string, rows: Array<Record<string, unknown>>, fallback: Record<string, unknown>) => {
    const worksheet = workbook.addWorksheet(name.slice(0, 31));
    const safeRows = rows.length ? rows : [fallback];
    const keys = Object.keys(safeRows[0] ?? {});
    worksheet.addRow(keys);
    safeRows.forEach((row) => worksheet.addRow(keys.map((key) => row[key] ?? '')));
    styleWorksheet(worksheet);
    return worksheet;
  };

  const summary = workbook.addWorksheet('Portada Resumen', { views: [{ showGridLines: false }] });
  summary.columns = [{ width: 24 }, { width: 28 }, { width: 28 }, { width: 28 }, { width: 28 }, { width: 42 }];
  summary.mergeCells('A1:F1');
  summary.getCell('A1').value = `BUYER NODUS | ${termsScopeTitle(scope)}`;
  summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primary } };
  summary.getCell('A1').font = { bold: true, color: { argb: 'FFFFFF' }, size: 15 };
  summary.getRow(1).height = 28;
  summary.mergeCells('A3:F3');
  summary.getCell('A3').value = asText(getTermsGeneralData(result).requirement_name ?? result.title, input.title);
  summary.getCell('A3').font = { bold: true, color: { argb: textColor }, size: 20 };
  summary.addRow([]);
  summary.addRow(['Fecha', formatDate(), 'Codigo', asText(result.process_code), 'Estado', asText(result.completion_level, 'Borrador')]);
  if (scope.hasPendingWarnings) summary.addRow(['Advertencia', 'Este documento contiene datos pendientes de completar.', '', '', '', '']);
  summary.getRow(5).eachCell((cell, colNumber) => {
    if (colNumber % 2 === 1) cell.font = { bold: true, color: { argb: primary } };
  });

  const kpis = getTermsDashboardKpis(result);
  summary.addRow([]);
  const titleRow = summary.addRow(['Panel del proceso']);
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: secondary } };
  titleRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  kpis.forEach((kpi, index) => {
    const row = 8 + Math.floor(index / 2) * 3;
    const col = 1 + (index % 2) * 3;
    summary.mergeCells(row, col, row, col + 2);
    summary.mergeCells(row + 1, col, row + 1, col + 2);
    summary.mergeCells(row + 2, col, row + 2, col + 2);
    summary.getCell(row, col).value = asText(kpi.title);
    summary.getCell(row + 1, col).value = asText(kpi.value);
    summary.getCell(row + 2, col).value = asText(kpi.description);
    [row, row + 1, row + 2].forEach((rowNumber) => {
      for (let colNumber = col; colNumber <= col + 2; colNumber += 1) {
        const cell = summary.getCell(rowNumber, colNumber);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNumber === row + 1 ? green : 'F8FAFC' } };
        cell.border = { top: { style: 'thin', color: { argb: 'E2E8F0' } }, bottom: { style: 'thin', color: { argb: 'E2E8F0' } }, left: { style: 'thin', color: { argb: 'E2E8F0' } }, right: { style: 'thin', color: { argb: 'E2E8F0' } } };
        cell.alignment = { vertical: 'middle', wrapText: true };
      }
    });
    summary.getCell(row, col).font = { bold: true, color: { argb: primary } };
    summary.getCell(row + 1, col).font = { bold: true, color: { argb: textColor }, size: 14 };
  });

  if (scope.documentCode === 'PACKAGE') addRowsSheet('Datos del proceso', getTermsKeyValueRows(result), { Campo: 'Datos del proceso', Valor: '[COMPLETAR]' });
  if (termsScopeIncludes(scope, 'cronograma')) {
    addRowsSheet(scope.documentCode === 'CRO-04' ? 'Resumen Cronograma' : 'Cronograma', getTermsKeyValueRows(result).filter((row) => /fecha|plazo|codigo|nombre/i.test(String(row.Campo))), { Campo: 'Resumen Cronograma', Valor: '[COMPLETAR]' });
    addRowsSheet('Cronograma completo', getTermsScheduleRows(result), { Fase: '[COMPLETAR]', N: 1, 'Actividad/Hito': '[COMPLETAR]', Responsable: '[COMPLETAR]' });
    addRowsSheet('Fases', getTermsScheduleRows(result).map((row) => ({ Fase: row.Fase, Hito: row['Actividad/Hito'], Inicio: row['Fecha inicio'], Fin: row['Fecha fin'] })), { Fase: '[COMPLETAR]', Hito: '[COMPLETAR]' });
    addRowsSheet('Hitos criticos', getTermsScheduleRows(result).filter((row) => /propuesta|adjudic|contrato|inicio/i.test(asText(row['Actividad/Hito'], ''))), { Hito: '[COMPLETAR]', Responsable: '[COMPLETAR]' });
    addRowsSheet('Responsables', getTermsScheduleRows(result).map((row) => ({ Hito: row['Actividad/Hito'], Responsable: row.Responsable, Observaciones: row.Observaciones })), { Hito: '[COMPLETAR]', Responsable: '[COMPLETAR]' });
  }
  if (termsScopeIncludes(scope, 'matrizRiesgos')) {
    addRowsSheet('Matriz de evaluacion', getTermsEvaluationRows(result), { Criterio: '[COMPLETAR]', 'Puntaje maximo': 100, 'Evidencia requerida': '[COMPLETAR]' });
  }
  if (termsScopeIncludes(scope, 'tdr') || termsScopeIncludes(scope, 'bases')) addRowsSheet('Requisitos proveedor', [
    ...termsListRows(asArray(getTermsDocument(result).supplier_conditions), 'Requisito').map((row) => ({ Requisito: row.Requisito, 'Obligatorio/Deseable': 'Obligatorio', Evidencia: '[COMPLETAR]', 'Aplica/No aplica': 'Aplica', Observaciones: '' })),
    ...getTermsComplianceRows(result).map((row) => ({ Requisito: row.Requisito, 'Obligatorio/Deseable': row['Obligatorio/Deseable'], Evidencia: row['Evidencia requerida'], 'Aplica/No aplica': 'Por validar', Observaciones: row.Comentario })),
  ], { Requisito: '[COMPLETAR]', 'Obligatorio/Deseable': 'Obligatorio', Evidencia: '[COMPLETAR]' });
  if (termsScopeIncludes(scope, 'tdr') || termsScopeIncludes(scope, 'bases')) addRowsSheet('Documentos solicitados', getTermsRequiredDocumentRows(result), { Codigo: 'DOC-01', Documento: '[COMPLETAR]', 'Responsable de entrega': 'Postor' });
  if (termsScopeIncludes(scope, 'matrizRiesgos')) addRowsSheet('Matriz cumplimiento', getTermsComplianceRows(result), { Requisito: '[COMPLETAR]', Tipo: 'Tecnico', 'Obligatorio/Deseable': 'Obligatorio', Estado: 'Por validar' });
  if (termsScopeIncludes(scope, 'matrizRiesgos') || termsScopeIncludes(scope, 'bases')) addRowsSheet('Garantias penalidades', getTermsGuaranteeRows(result), { Tipo: '[SUGERIDO]', 'Porcentaje/Monto': '[SUGERIDO]', 'Condicion de ejecucion': '[COMPLETAR]' });
  if (termsScopeIncludes(scope, 'matrizRiesgos')) addRowsSheet('Riesgos', getTermsRiskRows(result), { Riesgo: '[COMPLETAR]', Impacto: 'Medio', Mitigacion: '[SUGERIDO]' });
  if (termsScopeIncludes(scope, 'calidad')) addRowsSheet('Calidad', asArray(result.checklist).map(asRecord).map((item) => ({ Punto: item.label, Estado: item.status, Detalle: item.detail })), { Punto: '[COMPLETAR]', Estado: 'Pendiente' });
  if (termsScopeIncludes(scope, 'pendientes')) {
    const pendingRows = getTermsPendingRows(result);
    addRowsSheet('Pendientes', pendingRows, { 'Campo pendiente': 'Sin pendientes criticos detectados', Tipo: 'OK', Urgencia: 'Baja' });
    addRowsSheet('Completar', pendingRows.filter((row) => row.Tipo === '[COMPLETAR]'), { 'Campo pendiente': 'Sin pendientes criticos', Tipo: 'OK' });
    addRowsSheet('Sugeridos', pendingRows.filter((row) => row.Tipo === '[SUGERIDO]'), { 'Campo pendiente': 'Sin sugeridos pendientes', Tipo: 'OK' });
    addRowsSheet('Recomendaciones', termsListRows(asArray(result.buyer_recommendations), 'Recomendacion'), { N: 1, Recomendacion: 'Sin recomendaciones registradas' });
    addRowsSheet('Preguntas para completar', termsListRows(asArray(result.recommended_questions), 'Pregunta'), { N: 1, Pregunta: 'Sin preguntas registradas' });
  }
  if (termsScopeIncludes(scope, 'tdr')) {
    addRowsSheet('Resumen TDR', getTermsKeyValueRows(result), { Campo: 'Resumen TDR', Valor: '[COMPLETAR]' });
    addRowsSheet('TDR completo', getTermsTdrRows(result), { Seccion: 'TDR', Subseccion: '[COMPLETAR]', Contenido: '[COMPLETAR]' });
    addRowsSheet('Recomendaciones TDR', termsListRows(asArray(result.buyer_recommendations), 'Recomendacion'), { N: 1, Recomendacion: 'Sin recomendaciones registradas' });
  }
  if (termsScopeIncludes(scope, 'bases')) {
    addRowsSheet('Resumen Bases', getTermsKeyValueRows(result), { Campo: 'Resumen Bases', Valor: '[COMPLETAR]' });
    addRowsSheet('Bases completas', getTermsBasesRows(result), { Capitulo: 'Bases', Numeral: '[COMPLETAR]', Contenido: '[COMPLETAR]' });
    addRowsSheet('Evaluacion', getTermsEvaluationRows(result), { Criterio: '[COMPLETAR]', 'Puntaje maximo': 100 });
    addRowsSheet('Causales descalificacion', termsListRows(asArray(getTermsTenderBases(result).disqualification_conditions), 'Causal'), { N: 1, Causal: '[COMPLETAR]' });
  }
  if (termsScopeIncludes(scope, 'invitacion')) {
    addRowsSheet('Invitacion', getTermsInvitationRows(result), { Seccion: 'Invitacion', Contenido: '[COMPLETAR]', 'Variable editable': '{razon_social}' });
    addRowsSheet('Variables editables', [
      { Variable: '{nombre_contacto}', Descripcion: 'Nombre del contacto invitado' },
      { Variable: '{razon_social}', Descripcion: 'Empresa invitada' },
      { Variable: '{cargo}', Descripcion: 'Cargo del contacto' },
      { Variable: '{correo}', Descripcion: 'Correo del contacto' },
      { Variable: '{responsable_proceso}', Descripcion: 'Responsable interno del proceso' },
    ], { Variable: '{variable}', Descripcion: '[COMPLETAR]' });
    addRowsSheet('Fechas clave', getTermsKeyValueRows(result).filter((row) => /fecha|plazo/i.test(String(row.Campo))), { Campo: 'Fecha clave', Valor: '[COMPLETAR]' });
    addRowsSheet('Contactos', [{ Campo: 'Contacto del proceso', Valor: getTermsEmail(result).contact_details ?? '[COMPLETAR]' }], { Campo: 'Contacto', Valor: '[COMPLETAR]' });
  }
  if (termsScopeIncludes(scope, 'invitacion')) addRowsSheet('Postores invitados', asArray(result.invited_bidders).map(asRecord).map((item) => ({
    Contacto: item.contact_name,
    Empresa: item.business_name,
    Cargo: item.role,
    Correo: item.email,
  })), { Contacto: '[COMPLETAR: ingresar empresas invitadas]', Empresa: '[COMPLETAR]', Correo: '[COMPLETAR]' });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), getDefaultFileName(input, 'xlsx'));
}

async function downloadAgentResultXlsx(input: AgentExportInput) {
  const result = asRecord(input.result);
  if (isTermsOfReferenceResult(result)) {
    await downloadTermsOfReferenceXlsx(input, result);
    return;
  }
  const XLSX = await import('xlsx');
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
    throw new Error('Este agente solo permite descargar PDF, Excel o PowerPoint.');
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
  const scope = getTermsScope(input);
  let slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
  slide.addText(getBrandName(input.pdfMode ?? 'standard_branded', input.pdfOptions) || 'BUYER NODUS', { x: 0.55, y: 0.35, w: 6, h: 0.25, fontSize: 9, bold: true, color: '6B63D9' });
  slide.addText(termsScopeTitle(scope), { x: 0.55, y: 1.0, w: 11.9, h: 0.85, fontSize: 29, bold: true, color: '09008B', fit: 'shrink' });
  slide.addText(asText(result.executive_summary), { x: 0.6, y: 2.15, w: 11.7, h: 1.25, fontSize: 14, color: '334155', fit: 'shrink' });
  slide.addText(`Codigo: ${asText(result.process_code)}\nEntidad: ${asText(getTermsContractingEntity(result).business_name ?? '[COMPLETAR]')}\nFecha: ${formatDate()}`, {
    x: 0.65,
    y: 3.85,
    w: 5.8,
    h: 1.1,
    fontSize: 12,
    color: '475569',
    fit: 'shrink',
  });
  slide.addText(`Tipo: ${asText(document.tdr_type ?? result.requirement_type)}\nDocumentos: ${termsGeneratedDocuments(result).join(', ')}\nRiesgo: ${asText(result.risk_level)}`, {
    x: 6.9,
    y: 3.85,
    w: 5.4,
    h: 1.1,
    fontSize: 12,
    color: '475569',
    fit: 'shrink',
  });
  addPptFooter(slide, input);

  if (scope.hasPendingWarnings) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Advertencia de datos pendientes');
    slide.addText('Este documento contiene datos pendientes de completar. Puedes usarlo como borrador, pero conviene validar esos campos antes de enviarlo a proveedores.', { x: 0.8, y: 1.6, w: 11.2, h: 2.1, fontSize: 18, color: '92400E', fit: 'shrink' });
    addPptFooter(slide, input);
  }

  if (scope.documentCode === 'PACKAGE') {
  slide = pptx.addSlide();
  addPptTitle(slide, 'Resumen del paquete generado', 'Documentos y estado general del proceso de contratacion.');
  addPptRows(slide, [
    { Documento: 'TDR', Estado: termsHasDocument(result, 'tdr') ? 'Generado' : 'No solicitado', Uso: 'Detalle tecnico y alcance' },
    { Documento: 'Bases', Estado: termsHasDocument(result, 'bases') ? 'Generado' : 'No solicitado', Uso: 'Reglas del concurso' },
    { Documento: 'Invitacion', Estado: termsHasDocument(result, 'invitacion') ? 'Generado' : 'No solicitado', Uso: 'Correo formal a postores' },
    { Documento: 'Cronograma', Estado: termsHasDocument(result, 'cronograma') ? 'Generado' : 'No solicitado', Uso: 'Hitos y fechas del proceso' },
  ], { maxRows: 4 });
  addPptFooter(slide, input);
  }

  slide = pptx.addSlide();
  addPptTitle(slide, 'Datos clave del proceso');
  slide.addText(`Objeto: ${asText(bases.object ?? document.objective)}\n\nTipo: ${asText(document.tdr_type ?? result.requirement_type)}\nModalidad: ${asText(bases.modality ?? result.document_request)}\nPresupuesto: ${asText(bases.reference_budget ?? document.reference_budget, '[COMPLETAR]')}\nPlazo: ${asText(getTermsGeneralData(result).required_date, '[SUGERIDO]')}\nFecha limite: ${asText(bases.proposal_deadline, '[SUGERIDO]')}`, {
    x: 0.7,
    y: 1.35,
    w: 11.7,
    h: 4.8,
    fontSize: 12,
    color: '475569',
    fit: 'shrink',
  });
  addPptFooter(slide, input);

  slide = pptx.addSlide();
  addPptTitle(slide, 'Panel ejecutivo del proceso', 'KPIs del paquete con el mismo resultado visible en plataforma.');
  addPptKpiCards(slide, getTermsDashboardKpis(result));
  addPptFooter(slide, input);

  if (termsScopeIncludes(scope, 'tdr')) {
  slide = pptx.addSlide();
  addPptTitle(slide, 'Flujo del requerimiento');
  addPptRows(slide, termsListRows(asArray(result.flow_steps), 'Paso'), { maxRows: 12 });
  addPptFooter(slide, input);

  slide = pptx.addSlide();
  addPptTitle(slide, 'Objetivo', 'Objetivo de la contratacion y antecedentes relevantes.');
  slide.addText(`Objetivo: ${asText(document.objective)}\n\nAntecedentes: ${asText(document.background)}\n\nJustificacion: ${asText(document.justification)}`, {
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
  addPptTitle(slide, 'Alcance', 'Alcance del servicio o producto y cronograma sugerido.');
  slide.addText(`Alcance: ${asText(document.scope)}\n\nCronograma:\n${asArray(document.suggested_schedule).map((item) => `- ${asText(item)}`).join('\n')}`, {
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
  addPptTitle(slide, 'Tipo de TDR identificado');
  slide.addText(`${asText(document.tdr_type, result.requirement_type)}\n\nDocumentos generados: ${asArray(result.generated_documents).map(asText).join(', ')}\nCodigo de proceso: ${asText(result.process_code)}\n\n${asText(result.executive_summary)}`, {
    x: 0.65,
    y: 1.4,
    w: 11.8,
    h: 4.8,
    fontSize: 16,
    color: '334155',
    fit: 'shrink',
    breakLine: false,
  });
  addPptFooter(slide, input);

  [
    ['Caracteristicas tecnicas', asArray(document.technical_characteristics)],
    ['Documentacion requerida', asArray(document.required_documents)],
    ['Normas y condiciones de ejecucion', [...asArray(document.applicable_standards).map((item) => `Marco: ${asText(item)}`), ...asArray(document.execution_conditions).map((item) => `Ejecucion: ${asText(item)}`)]],
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
  }

  if (termsScopeIncludes(scope, 'matrizRiesgos')) {
  slide = pptx.addSlide();
  addPptTitle(slide, 'Requisitos clave', 'Matriz de cumplimiento resumida para proveedores.');
  addPptRows(slide, asArray(document.compliance_matrix).map(asRecord).map((item) => ({
    Requisito: item.requirement,
    Evidencia: item.expected_evidence,
    Obligatorio: item.mandatory,
    Estado: item.status,
  })), { maxRows: 8 });
  addPptFooter(slide, input);

  slide = pptx.addSlide();
  addPptTitle(slide, 'Criterios de evaluacion');
  addPptRows(slide, asArray(document.evaluation_matrix).map(asRecord).map((item) => ({
    Criterio: item.criterion,
    Puntaje: item.score,
    Evidencia: item.required_evidence,
  })).concat(termsListRows(asArray(bases.award_criteria), 'Criterio de adjudicacion')), { maxRows: 10 });
  addPptFooter(slide, input);
  }

  if (termsHasDocument(result, 'bases')) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Bases del Concurso', 'Reglas principales, etapas y condiciones de presentacion.');
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
  }

  if (termsScopeIncludes(scope, 'matrizRiesgos')) {
  slide = pptx.addSlide();
  addPptTitle(slide, 'Riesgos');
  addPptRows(slide, asArray(document.identified_risks).map(asRecord).map((item) => ({
    Riesgo: item.risk,
    Impacto: item.impact,
    Mitigacion: item.mitigation,
  })), { maxRows: 8 });
  addPptFooter(slide, input);
  }

  if (termsHasDocument(result, 'bases')) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Requisitos y condiciones del concurso');
    addPptRows(slide, [
      ...termsListRows(asArray(bases.minimum_supplier_requirements), 'Requisito'),
      ...termsListRows(asArray(bases.requested_documentation), 'Documentacion'),
      ...termsListRows(asArray(bases.proposal_submission_conditions), 'Condicion'),
      ...termsListRows(asArray(bases.award_criteria), 'Criterio'),
      ...termsListRows(asArray(bases.disqualification_conditions), 'Descalificacion'),
      ...termsListRows(asArray(bases.buyer_observations), 'Observacion'),
    ], { maxRows: 12 });
    addPptFooter(slide, input);
  }

  if (termsHasDocument(result, 'invitacion')) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Invitacion a postores', 'Resumen del correo formal y fechas clave.');
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
  }

  if (termsHasDocument(result, 'cronograma') || termsHasDocument(result, 'bases')) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Proceso sugerido de seleccion');
    addPptRows(slide, termsListRows(asArray(result.tender_process), 'Paso'), { maxRows: 10 });
    addPptFooter(slide, input);
  }

  if (termsScopeIncludes(scope, 'pendientes')) {
  slide = pptx.addSlide();
  addPptTitle(slide, 'Faltantes y recomendaciones');
  addPptRows(slide, [
    ...termsListRows(asArray(result.missing_information), 'Informacion faltante'),
    ...termsListRows(asArray(result.buyer_recommendations), 'Recomendacion'),
    ...termsListRows(asArray(result.recommended_questions), 'Pregunta recomendada'),
  ], { maxRows: 12 });
  addPptFooter(slide, input);
  }

  if (termsHasDocument(result, 'cronograma')) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Cronograma del proceso', 'Linea de tiempo visual con fases e hitos criticos.');
    addPptRows(slide, getTermsScheduleRows(result).map((item) => ({
      Fase: item.Fase,
      Hito: item['Actividad/Hito'],
      Inicio: item['Fecha inicio'],
      Fin: item['Fecha fin'],
      Entregable: item.Entregable,
    })), { maxRows: 9 });
    addPptFooter(slide, input);
  }

  if (termsScopeIncludes(scope, 'pendientes') || termsScopeIncludes(scope, 'calidad')) {
  slide = pptx.addSlide();
  addPptTitle(slide, 'Recomendacion final');
  slide.addText([
    asArray(result.buyer_recommendations).map((item) => `- ${asText(item)}`).join('\n'),
    '',
    'Datos por validar:',
    asArray(result.missing_information).map((item) => `- ${asText(item)}`).join('\n'),
  ].join('\n'), { x: 0.65, y: 1.25, w: 11.8, h: 5.4, fontSize: 12, color: '334155', fit: 'shrink', breakLine: false });
  addPptFooter(slide, input);
  }

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

function mapAgentExportFormat(format: AgentExportFormat): ExportFormat | undefined {
  if (format === 'pdf') return 'pdf';
  if (format === 'xlsx') return 'excel';
  if (format === 'pptx') return 'ppt';
  return undefined;
}

function exportBlockRows(block: ExportBlock): Array<Record<string, unknown>> {
  const data = block.data;
  const record = asRecord(data);
  if (Array.isArray(record.columns) && Array.isArray(record.rows)) {
    const columns = asArray(record.columns).map((column) => asText(column, '')).filter(Boolean);
    return asArray(record.rows).map(asRecord).map((row) => columns.reduce<Record<string, unknown>>((acc, column) => {
      acc[column] = row[column] ?? '';
      return acc;
    }, {}));
  }
  if (Array.isArray(data)) {
    if (data.every((item) => {
      const itemRecord = asRecord(item);
      return Array.isArray(itemRecord.columns) && Array.isArray(itemRecord.rows);
    })) {
      return data.flatMap((item) => {
        const table = asRecord(item);
        return exportBlockRows({ ...block, data: table }).map((row) => ({
          Tabla: table.title ?? block.title,
          ...row,
        }));
      });
    }
    if (data.every((item) => item && typeof item === 'object' && !Array.isArray(item))) return data.map(asRecord);
    return data.map((item, index) => ({ N: index + 1, Detalle: asText(item, '') })).filter((row) => row.Detalle);
  }
  if (data && typeof data === 'object') return rowsFromValue(data);
  const detail = asText(data, '');
  return detail ? [{ Detalle: detail }] : [];
}

function exportTableBlocks(block: ExportBlock): Array<{ title: string; rows: Array<Record<string, unknown>> }> {
  const data = block.data;
  if (Array.isArray(data)) {
    const tableBlocks = data
      .map(asRecord)
      .filter((item) => Array.isArray(item.columns) && Array.isArray(item.rows))
      .map((item) => ({
        title: asText(item.title, block.title || blockLabel(block.type)),
        rows: exportBlockRows({ ...block, data: item }),
      }))
      .filter((item) => item.rows.length);
    if (tableBlocks.length) return tableBlocks;
  }
  const rows = exportBlockRows(block);
  return rows.length ? [{ title: block.title || blockLabel(block.type), rows }] : [];
}

function isDashboardExportPayload(payload: ExportPayload) {
  return payload.agentId === 'dashboard_creator' || payload.agentId.includes('dashboard');
}

function isProposalExportPayload(payload: ExportPayload) {
  return payload.agentId === 'proposal_comparison' || payload.agentId.includes('proposal') || payload.agentId.includes('quote');
}

function exportBlocksByType(payload: ExportPayload, type: ExportBlock['type']) {
  return payload.blocks.filter((block) => block.type === type);
}

function firstExportBlock(payload: ExportPayload, type: ExportBlock['type']) {
  return exportBlocksByType(payload, type)[0];
}

function dashboardPayloadKpis(payload: ExportPayload) {
  return exportBlocksByType(payload, 'kpi')
    .flatMap((block) => asArray(block.data).map(asRecord))
    .filter((item) => dashboardBusinessText(item.title) && asText(item.value, ''));
}

function dashboardPayloadCharts(payload: ExportPayload) {
  return exportBlocksByType(payload, 'chart')
    .flatMap((block) => asArray(block.data).map(asRecord))
    .filter((item) => dashboardBusinessText(item.title) && dashboardChartDataRows(item).length);
}

function dashboardPayloadTables(payload: ExportPayload) {
  return exportBlocksByType(payload, 'table')
    .flatMap((block) => exportTableBlocks(block))
    .filter((table) => table.rows.length);
}

function dashboardPayloadRankings(payload: ExportPayload) {
  return exportBlocksByType(payload, 'ranking')
    .flatMap((block) => exportTableBlocks(block))
    .filter((table) => table.rows.length);
}

function dashboardPayloadRows(payload: ExportPayload, types: ExportBlock['type'][]) {
  return payload.blocks
    .filter((block) => types.includes(block.type))
    .flatMap((block) => exportBlockRows(block).slice(0, 8).map((row) => ({
      Seccion: block.title || blockLabel(block.type),
      Detalle: Object.values(row).map((value) => asText(value, '')).filter(Boolean).join(' | '),
    })))
    .filter((row) => row.Detalle);
}

function dashboardPayloadFilterRows(payload: ExportPayload) {
  const rows = dashboardPayloadRows(payload, ['dashboard_filter']);
  if (rows.length) return rows;
  return payload.subtitle
    ? payload.subtitle.split('|').map((item) => ({ Seccion: 'Filtro', Detalle: item.trim() })).filter((row) => row.Detalle)
    : [];
}

function proposalPayloadKpis(payload: ExportPayload) {
  return exportBlocksByType(payload, 'kpi')
    .flatMap((block) => asArray(block.data).map(asRecord))
    .filter((item) => asText(item.title, '') && asText(item.value, ''));
}

function proposalPayloadRows(payload: ExportPayload, types: ExportBlock['type'][]) {
  return payload.blocks
    .filter((block) => types.includes(block.type))
    .flatMap((block) => exportBlockRows(block).slice(0, 8).map((row) => ({
      Seccion: block.title || blockLabel(block.type),
      Detalle: Object.values(row).map((value) => asText(value, '')).filter(Boolean).join(' | '),
    })))
    .filter((row) => row.Detalle);
}

function proposalPayloadTables(payload: ExportPayload, types: ExportBlock['type'][] = ['ranking', 'matrix', 'table']) {
  return payload.blocks
    .filter((block) => types.includes(block.type))
    .flatMap((block) => exportTableBlocks(block))
    .filter((table) => table.rows.length);
}

function proposalMainDecision(payload: ExportPayload) {
  const decision = firstExportBlock(payload, 'decision');
  const rows = decision ? exportBlockRows(decision) : [];
  return rows[0] ?? {};
}

function addProposalPayloadPdf(input: PdfInput, payload: ExportPayload, format: ExportFormat = 'pdf') {
  const cleanPayload = { ...payload, blocks: cleanExportBlocks(payload.blocks, format) };
  const ctx = createContext({ ...input, title: cleanPayload.title });
  ctx.primaryColor = buyerNodusExportTheme.colors.navy;
  const summary = firstExportBlock(cleanPayload, 'summary');
  const decision = proposalMainDecision(cleanPayload);
  const kpis = proposalPayloadKpis(cleanPayload);
  const rankingTables = proposalPayloadTables(cleanPayload, ['ranking']);
  const matrixTables = proposalPayloadTables(cleanPayload, ['matrix', 'table']);
  const risks = proposalPayloadRows(cleanPayload, ['risk']);
  const recommendations = proposalPayloadRows(cleanPayload, ['recommendation']);
  const alerts = proposalPayloadRows(cleanPayload, ['alert']);

  addHeader(ctx, { ...input, title: cleanPayload.title }, cleanPayload.subtitle);
  if (summary) addCard(ctx, 'Resumen ejecutivo', formatValue(summary.data).slice(0, 5), 'blue');
  if (Object.keys(decision).length) {
    const tone = asText(decision.Estado, '').toLowerCase().includes('validacion') ? 'amber' : 'green';
    addCard(ctx, asText(decision.Decision, 'Decision ejecutiva'), [
      asText(decision.Sustento, ''),
      asText(decision.Estado, ''),
    ].filter(Boolean), tone);
  }
  if (kpis.length) addDashboardKpiCards(ctx, kpis);
  rankingTables.slice(0, 2).forEach((table) => addExportPayloadTable(ctx, table.title, table.rows, 8));
  matrixTables.slice(0, 3).forEach((table) => addExportPayloadTable(ctx, table.title, table.rows, 8));
  if (risks.length) addCard(ctx, 'Riesgos principales', risks.slice(0, 6).map((row) => row.Detalle), 'amber');
  if (recommendations.length) addCard(ctx, 'Recomendaciones de negociacion', recommendations.slice(0, 6).map((row) => row.Detalle), 'green');
  if (alerts.length) addCard(ctx, 'Informacion requerida para cerrar decision', alerts.slice(0, 5).map((row) => row.Detalle), 'amber');
  addFooter(ctx);
  ctx.doc.save(input.fileName ?? getDefaultFileName(input, 'pdf'));
}

function addDashboardPayloadPdf(input: PdfInput, payload: ExportPayload, format: ExportFormat = 'pdf') {
  const cleanPayload = { ...payload, blocks: cleanExportBlocks(payload.blocks, format) };
  const ctx = createContext({ ...input, title: cleanPayload.title });
  ctx.primaryColor = buyerNodusExportTheme.colors.navy;
  const summary = firstExportBlock(cleanPayload, 'summary');
  const kpis = dashboardPayloadKpis(cleanPayload);
  const charts = dashboardPayloadCharts(cleanPayload);
  const tables = dashboardPayloadTables(cleanPayload);
  const rankings = dashboardPayloadRankings(cleanPayload);
  const filters = dashboardPayloadFilterRows(cleanPayload);
  const alerts = dashboardPayloadRows(cleanPayload, ['alert']);
  const insights = dashboardPayloadRows(cleanPayload, ['insight']);
  const recommendations = dashboardPayloadRows(cleanPayload, ['recommendation']);

  addHeader(ctx, { ...input, title: cleanPayload.title }, cleanPayload.subtitle || 'Dashboard ejecutivo de compras');
  if (summary) {
    addCard(ctx, 'Resumen ejecutivo', formatValue(summary.data).slice(0, 4), 'blue');
  }
  if (kpis.length) addDashboardKpiCards(ctx, kpis);
  if (filters.length) {
    addSection(ctx, 'Filtros del dashboard', 28);
    addTable(ctx, ['Filtro', 'Valor'], filters.slice(0, 6).map((row) => [row.Seccion, row.Detalle]), [42, ctx.maxWidth - 42]);
  }
  if (charts.length) {
    addSection(ctx, 'Visualizaciones principales', 48);
    charts.slice(0, 6).forEach((chart) => addDashboardChartVisual(ctx, chart));
  }
  if (rankings.length || tables.length) {
    addSection(ctx, 'Rankings y tablas ejecutivas', 44);
    rankings.slice(0, 2).forEach((table) => addExportPayloadTable(ctx, table.title, table.rows, 8));
    tables.slice(0, 3).forEach((table) => addExportPayloadTable(ctx, table.title, table.rows, 8));
  }
  if (alerts.length) {
    addCard(ctx, 'Alertas ejecutivas', alerts.map((row) => row.Detalle).slice(0, 5), 'amber');
  }
  if (insights.length) {
    addSection(ctx, 'Insights rapidos', 34);
    addTable(ctx, ['Insight', 'Detalle'], insights.slice(0, 6).map((row) => [row.Seccion, row.Detalle]), [42, ctx.maxWidth - 42]);
  }
  if (recommendations.length) {
    addCard(ctx, 'Recomendaciones accionables', recommendations.map((row) => row.Detalle).slice(0, 6), 'green');
  }
  addFooter(ctx);
  ctx.doc.save(input.fileName ?? getDefaultFileName(input, 'pdf'));
}

function dashboardExcelBarText(value: unknown, max: number) {
  const numeric = Number(value) || 0;
  const length = Math.max(1, Math.round((numeric / Math.max(max, 1)) * 18));
  return '█'.repeat(length);
}

function setSheetAutofilter(XLSX: XlsxModule, sheet: import('xlsx').WorkSheet, rowCount: number, colCount: number) {
  if (rowCount > 1 && colCount > 0) {
    sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: colCount - 1, r: rowCount - 1 } }) };
  }
}

function appendDashboardAoaSheet(
  XLSX: XlsxModule,
  workbook: import('xlsx').WorkBook,
  used: Set<string>,
  name: string,
  rows: unknown[][],
  widths: number[] = [],
  freezeRow = 1,
) {
  const nonEmptyRows = rows.filter((row) => row.some((cell) => asText(cell, '').trim()));
  if (!nonEmptyRows.length) return;
  const sheet = XLSX.utils.aoa_to_sheet(nonEmptyRows);
  sheet['!cols'] = widths.length ? widths.map((wch) => ({ wch })) : nonEmptyRows[0].map((cell) => ({ wch: Math.min(Math.max(asText(cell, '').length + 8, 16), 56) }));
  (sheet as import('xlsx').WorkSheet & { '!freeze'?: unknown })['!freeze'] = { xSplit: 0, ySplit: freezeRow };
  XLSX.utils.book_append_sheet(workbook, sheet, normalizeSheetName(name, used));
}

function appendDashboardJsonSheet(
  XLSX: XlsxModule,
  workbook: import('xlsx').WorkBook,
  used: Set<string>,
  name: string,
  rows: Array<Record<string, unknown>>,
) {
  const cleanedRows = rows
    .map((row) => Object.fromEntries(Object.entries(row).filter(([, value]) => asText(value, '').trim())))
    .filter((row) => Object.keys(row).length);
  if (!cleanedRows.length) return;
  const sheet = XLSX.utils.json_to_sheet(cleanedRows);
  const columns = Object.keys(cleanedRows[0] ?? {});
  sheet['!cols'] = columns.map((column) => ({ wch: Math.min(Math.max(column.length + 8, 18), 58) }));
  setSheetAutofilter(XLSX, sheet, cleanedRows.length + 1, columns.length);
  (sheet as import('xlsx').WorkSheet & { '!freeze'?: unknown })['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(workbook, sheet, normalizeSheetName(name, used));
}

async function downloadDashboardExportPayloadXlsx(input: AgentExportInput, payload: ExportPayload) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const used = new Set<string>();
  const cleanPayload = { ...payload, blocks: cleanExportBlocks(payload.blocks, 'excel') };
  const summary = firstExportBlock(cleanPayload, 'summary');
  const kpis = dashboardPayloadKpis(cleanPayload);
  const charts = dashboardPayloadCharts(cleanPayload);
  const tables = dashboardPayloadTables(cleanPayload);
  const rankings = dashboardPayloadRankings(cleanPayload);
  const filters = dashboardPayloadFilterRows(cleanPayload);
  const alerts = dashboardPayloadRows(cleanPayload, ['alert']);
  const insights = dashboardPayloadRows(cleanPayload, ['insight']);
  const recommendations = dashboardPayloadRows(cleanPayload, ['recommendation']);
  const chartRowsForDashboard = charts.slice(0, 5).flatMap((chart) => {
    const rows = dashboardChartDataRows(chart).slice(0, 8);
    const max = Math.max(...rows.map((row) => Number(row.Valor) || 0), 1);
    return rows.map((row) => ({
      Visualizacion: asText(chart.title, 'Visualizacion'),
      Etiqueta: row.Etiqueta,
      Valor: row.Valor,
      Barra: dashboardExcelBarText(row.Valor, max),
      Insight: dashboardBusinessText(chart.insight),
    }));
  });

  const dashboardRows: unknown[][] = [
    ['BUYER NODUS | Dashboard ejecutivo de compras', '', '', '', ''],
    ['Dashboard', cleanPayload.title, 'Fecha', formatDate(), ''],
    ['Alcance', cleanPayload.subtitle || 'Informacion cargada por el usuario', '', '', ''],
    [],
    ['KPIs principales', '', '', '', ''],
    ['Indicador', 'Valor', 'Interpretacion', 'Estado', ''],
    ...kpis.slice(0, 8).map((kpi) => [
      dashboardBusinessText(kpi.title),
      asText(kpi.value, ''),
      dashboardBusinessText(kpi.description),
      dashboardBusinessText(kpi.status, 'neutro'),
      '',
    ]),
    [],
    ...(filters.length ? [
      ['Filtros visuales', '', '', '', ''],
      ['Filtro', 'Valor', '', '', ''],
      ...filters.slice(0, 6).map((row) => [row.Seccion, row.Detalle, '', '', '']),
      [],
    ] : []),
    ...(chartRowsForDashboard.length ? [
      ['Visualizaciones principales', '', '', '', ''],
      ['Visualizacion', 'Etiqueta', 'Valor', 'Barra', 'Insight'],
      ...chartRowsForDashboard.slice(0, 28).map((row) => [row.Visualizacion, row.Etiqueta, row.Valor, row.Barra, row.Insight]),
      [],
    ] : []),
    ...(rankings.length ? [
      ['Rankings visibles', '', '', '', ''],
      ...rankings.slice(0, 2).flatMap((table) => [
        [table.title, '', '', '', ''],
        ...table.rows.slice(0, 8).map((row) => Object.values(row).slice(0, 5)),
      ]),
      [],
    ] : []),
    ...(alerts.length ? [
      ['Alertas ejecutivas', '', '', '', ''],
      ['Seccion', 'Detalle', '', '', ''],
      ...alerts.slice(0, 5).map((row) => [row.Seccion, row.Detalle, '', '', '']),
      [],
    ] : []),
    ...(insights.length || recommendations.length ? [
      ['Insights y recomendaciones', '', '', '', ''],
      ['Tipo', 'Detalle', '', '', ''],
      ...insights.slice(0, 5).map((row) => ['Insight', row.Detalle, '', '', '']),
      ...recommendations.slice(0, 6).map((row) => ['Recomendacion', row.Detalle, '', '', '']),
    ] : []),
  ];
  if (summary && !dashboardRows.some((row) => row.includes('Resumen ejecutivo'))) {
    dashboardRows.splice(4, 0, ['Resumen ejecutivo', formatValue(summary.data).slice(0, 3).join(' | '), '', '', ''], []);
  }
  appendDashboardAoaSheet(XLSX, workbook, used, '01_Dashboard', dashboardRows, [32, 34, 18, 28, 54], 6);
  appendDashboardJsonSheet(XLSX, workbook, used, '02_KPIs', kpis.map((kpi) => ({
    Indicador: dashboardBusinessText(kpi.title),
    Valor: asText(kpi.value, ''),
    Unidad: asText(kpi.unit, ''),
    Interpretacion: dashboardBusinessText(kpi.description),
    Estado: dashboardBusinessText(kpi.status, ''),
  })));
  appendDashboardJsonSheet(XLSX, workbook, used, '03_Visualizaciones', chartRowsForDashboard);
  rankings.forEach((table, index) => appendDashboardJsonSheet(XLSX, workbook, used, `${String(index + 4).padStart(2, '0')}_${table.title}`, table.rows));
  tables.forEach((table, index) => appendDashboardJsonSheet(XLSX, workbook, used, `${String(index + 6).padStart(2, '0')}_${table.title}`, table.rows));
  appendDashboardJsonSheet(XLSX, workbook, used, '90_Insights_Recomendaciones', [
    ...insights.map((row) => ({ Tipo: 'Insight', Seccion: row.Seccion, Detalle: row.Detalle })),
    ...recommendations.map((row) => ({ Tipo: 'Recomendacion', Seccion: row.Seccion, Detalle: row.Detalle })),
  ]);
  appendDashboardJsonSheet(XLSX, workbook, used, '91_Alertas', alerts);
  XLSX.writeFile(workbook, getDefaultFileName(input, 'xlsx'));
}

async function downloadProposalExportPayloadXlsx(input: AgentExportInput, payload: ExportPayload) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const used = new Set<string>();
  const cleanPayload = { ...payload, blocks: cleanExportBlocks(payload.blocks, 'excel') };
  const summary = firstExportBlock(cleanPayload, 'summary');
  const decision = proposalMainDecision(cleanPayload);
  const kpis = proposalPayloadKpis(cleanPayload);
  const rankings = proposalPayloadTables(cleanPayload, ['ranking']);
  const matrices = proposalPayloadTables(cleanPayload, ['matrix', 'table']);
  const risks = proposalPayloadRows(cleanPayload, ['risk']);
  const recommendations = proposalPayloadRows(cleanPayload, ['recommendation']);
  const alerts = proposalPayloadRows(cleanPayload, ['alert']);

  appendDashboardAoaSheet(XLSX, workbook, used, '01_Resumen', [
    ['BUYER NODUS | Comparativo ejecutivo de proveedores', '', '', '', ''],
    ['Comparativo', cleanPayload.title, 'Fecha', formatDate(), ''],
    ['Alcance', cleanPayload.subtitle || 'Propuestas cargadas por el usuario', '', '', ''],
    [],
    ['Decision ejecutiva', '', '', '', ''],
    ['Decision', asText(decision.Decision, 'Decision no concluyente'), 'Estado', asText(decision.Estado, 'Requiere validacion'), ''],
    ['Sustento', asText(decision.Sustento, ''), '', '', ''],
    [],
    ...(summary ? [['Resumen ejecutivo', formatValue(summary.data).slice(0, 3).join(' | '), '', '', ''], []] : []),
    ['KPIs principales', '', '', '', ''],
    ['Indicador', 'Valor', 'Interpretacion', '', ''],
    ...kpis.slice(0, 6).map((kpi) => [asText(kpi.title), asText(kpi.value), asText(kpi.description, ''), '', '']),
    [],
    ...(rankings[0]?.rows.length ? [
      ['Ranking visual', '', '', '', ''],
      ...rankings[0].rows.slice(0, 8).map((row) => Object.values(row).slice(0, 5)),
      [],
    ] : []),
    ...(alerts.length ? [
      ['Advertencias profesionales', '', '', '', ''],
      ...alerts.slice(0, 5).map((row) => [row.Detalle, '', '', '', '']),
      [],
    ] : []),
    ...(recommendations.length ? [
      ['Recomendaciones de negociacion', '', '', '', ''],
      ...recommendations.slice(0, 6).map((row) => [row.Detalle, '', '', '', '']),
    ] : []),
  ], [28, 44, 18, 28, 36], 10);

  if (matrices[0]?.rows.length) appendDashboardJsonSheet(XLSX, workbook, used, '02_Matriz_Comparativa', matrices[0].rows);
  if (rankings[0]?.rows.length) appendDashboardJsonSheet(XLSX, workbook, used, '03_Ranking', rankings[0].rows);
  appendDashboardJsonSheet(XLSX, workbook, used, '04_Riesgos_Recomendaciones', [
    ...risks.map((row) => ({ Tipo: 'Riesgo', Detalle: row.Detalle })),
    ...recommendations.map((row) => ({ Tipo: 'Recomendacion', Detalle: row.Detalle })),
    ...alerts.map((row) => ({ Tipo: 'Advertencia', Detalle: row.Detalle })),
  ]);
  matrices.slice(1).forEach((table, index) => appendDashboardJsonSheet(XLSX, workbook, used, `${String(index + 5).padStart(2, '0')}_${table.title}`, table.rows));
  XLSX.writeFile(workbook, getDefaultFileName(input, 'xlsx'));
}

function addExportPayloadTable(ctx: PdfContext, title: string, rows: Array<Record<string, unknown>>, maxRows = 10) {
  const keys = Object.keys(rows[0] ?? {}).slice(0, 6);
  if (!keys.length) return;
  ensureBlock(ctx, 30);
  addText(ctx, title, { size: 9.5, bold: true, color: '#0f172a' });
  addTable(
    ctx,
    keys,
    rows.slice(0, maxRows).map((row) => keys.map((key) => row[key])),
    keys.map(() => ctx.maxWidth / keys.length),
  );
}

function addExportPayloadPdf(input: PdfInput, payload: ExportPayload, format: ExportFormat = 'pdf') {
  const cleanPayload = { ...payload, blocks: cleanExportBlocks(payload.blocks, format) };
  if (isDashboardExportPayload(cleanPayload)) {
    addDashboardPayloadPdf(input, cleanPayload, format);
    return;
  }
  if (isProposalExportPayload(cleanPayload)) {
    addProposalPayloadPdf(input, cleanPayload, format);
    return;
  }
  const ctx = createContext({ ...input, title: cleanPayload.title });
  ctx.primaryColor = buyerNodusExportTheme.colors.navy;
  addHeader(ctx, { ...input, title: cleanPayload.title }, cleanPayload.subtitle);

  cleanPayload.blocks.forEach((block) => {
    const title = block.title || blockLabel(block.type);
    if (block.type === 'summary' || block.type === 'decision' || block.type === 'recommendation') {
      addCard(ctx, title, formatValue(block.data).slice(0, 8), block.type === 'decision' || block.type === 'recommendation' ? 'green' : 'blue');
      return;
    }
    if (block.type === 'alert' || block.type === 'risk') {
      addCard(ctx, title, formatValue(block.data).slice(0, 8), 'amber');
      return;
    }
    if (block.type === 'kpi') {
      const kpis = asArray(block.data).map(asRecord);
      if (kpis.length) addDashboardKpiCards(ctx, kpis);
      exportTableBlocks(block).forEach((table) => addExportPayloadTable(ctx, table.title, table.rows, 8));
      return;
    }
    if (block.type === 'chart') {
      const charts = asArray(block.data).map(asRecord);
      if (charts.length) {
        addSection(ctx, title, 44);
        charts.slice(0, 5).forEach((chart) => addDashboardChartVisual(ctx, chart));
        return;
      }
    }

    exportTableBlocks(block).forEach((table) => addExportPayloadTable(ctx, table.title, table.rows));
  });

  addFooter(ctx);
  ctx.doc.save(input.fileName ?? getDefaultFileName(input, 'pdf'));
}

async function downloadExportPayloadXlsx(input: AgentExportInput, payload: ExportPayload) {
  if (isDashboardExportPayload(payload)) {
    await downloadDashboardExportPayloadXlsx(input, payload);
    return;
  }
  if (isProposalExportPayload(payload)) {
    await downloadProposalExportPayloadXlsx(input, payload);
    return;
  }
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const used = new Set<string>();
  const cleanPayload = { ...payload, blocks: cleanExportBlocks(payload.blocks, 'excel') };

  const dashboardRows = [
    { Seccion: 'Titulo', Detalle: cleanPayload.title },
    ...(cleanPayload.subtitle ? [{ Seccion: 'Subtitulo', Detalle: cleanPayload.subtitle }] : []),
    ...cleanPayload.blocks
      .filter((block) => ['summary', 'decision', 'recommendation', 'alert'].includes(block.type))
      .flatMap((block) => exportBlockRows(block).slice(0, 6).map((row) => ({
        Seccion: block.title || blockLabel(block.type),
        Detalle: Object.values(row).map((value) => asText(value, '')).filter(Boolean).join(' | '),
      }))),
  ].filter((row) => row.Detalle);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dashboardRows), normalizeSheetName('Dashboard', used));

  cleanPayload.blocks.forEach((block) => {
    exportTableBlocks(block).forEach((table) => {
      if (!table.rows.length) return;
      const sheet = XLSX.utils.json_to_sheet(table.rows);
      const columns = Object.keys(table.rows[0] ?? {});
      sheet['!cols'] = columns.map((column) => ({ wch: Math.min(Math.max(column.length + 6, 16), 48) }));
      if (columns.length && table.rows.length) {
        sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: columns.length - 1, r: table.rows.length } }) };
      }
      XLSX.utils.book_append_sheet(workbook, sheet, normalizeSheetName(table.title, used));
    });
  });

  XLSX.writeFile(workbook, getDefaultFileName(input, 'xlsx'));
}

async function downloadDashboardExportPayloadPptx(input: AgentExportInput, payload: ExportPayload) {
  const pptxgen = (await import('pptxgenjs')).default;
  const pptx = new pptxgen();
  const cleanPayload = { ...payload, blocks: cleanExportBlocks(payload.blocks, 'ppt') };
  const summary = firstExportBlock(cleanPayload, 'summary');
  const kpis = dashboardPayloadKpis(cleanPayload);
  const charts = dashboardPayloadCharts(cleanPayload);
  const tables = dashboardPayloadTables(cleanPayload);
  const rankings = dashboardPayloadRankings(cleanPayload);
  const alerts = dashboardPayloadRows(cleanPayload, ['alert']);
  const insights = dashboardPayloadRows(cleanPayload, ['insight']);
  const recommendations = dashboardPayloadRows(cleanPayload, ['recommendation']);

  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Buyer Nodus';
  pptx.subject = input.agentName || cleanPayload.title;
  pptx.title = cleanPayload.title;
  pptx.company = getBrandName(input.pdfMode ?? 'standard_branded', input.pdfOptions) || 'Buyer Nodus';
  pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'es-PE' };

  let slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
  slide.addText(getBrandName(input.pdfMode ?? 'standard_branded', input.pdfOptions) || 'BUYER NODUS', { x: 0.55, y: 0.35, w: 6, h: 0.25, fontSize: 9, bold: true, color: 'F97316' });
  slide.addText(cleanPayload.title, { x: 0.55, y: 1.0, w: 11.9, h: 0.9, fontSize: 30, bold: true, color: '09008B', fit: 'shrink' });
  slide.addShape('rect', { x: 0.55, y: 2.05, w: 2.4, h: 0.08, fill: { color: 'F97316' }, line: { color: 'F97316' } });
  if (cleanPayload.subtitle) slide.addText(cleanPayload.subtitle, { x: 0.6, y: 2.35, w: 11.7, h: 0.5, fontSize: 13, color: '334155', fit: 'shrink' });
  if (summary) slide.addText(formatValue(summary.data).slice(0, 2).join('\n'), { x: 0.65, y: 3.05, w: 11.6, h: 1.3, fontSize: 14, color: '334155', fit: 'shrink' });
  addPptFooter(slide, input);

  if (summary) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Resumen ejecutivo', 'Lectura rapida del dashboard de compras.');
    slide.addShape('roundRect', { x: 0.7, y: 1.35, w: 11.8, h: 3.7, fill: { color: 'EEF2FF' }, line: { color: 'CBD5E1', pt: 1 }, radius: 0.12 });
    slide.addText(formatValue(summary.data).slice(0, 5).join('\n'), { x: 1.05, y: 1.75, w: 11.0, h: 2.8, fontSize: 15, color: '1F2937', fit: 'shrink' });
    addPptFooter(slide, input);
  }

  if (kpis.length) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'KPIs principales', 'Indicadores ejecutivos del dashboard.');
    addPptKpiCards(slide, kpis.slice(0, 6));
    addPptFooter(slide, input);
  }

  if (charts.length) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Visualizaciones principales', 'Paneles principales para lectura tipo dashboard.');
    charts.slice(0, 2).forEach((chart, index) => {
      const x = index === 0 ? 0.65 : 6.85;
      slide.addText(asText(chart.title, 'Visualizacion'), { x, y: 1.3, w: 5.65, h: 0.3, fontSize: 12, bold: true, color: '09008B', fit: 'shrink' });
      addPptChartVisual(slide, chart, { x, y: 1.85, w: 5.65, h: 3.7 });
      slide.addText(dashboardBusinessText(chart.insight), { x, y: 5.78, w: 5.65, h: 0.42, fontSize: 8, color: '334155', fit: 'shrink' });
    });
    addPptFooter(slide, input);
  }

  charts.slice(2, 4).forEach((chart) => {
    slide = pptx.addSlide();
    addPptTitle(slide, asText(chart.title, 'Visualizacion'), dashboardBusinessText(chart.description));
    addPptChartVisual(slide, chart, { x: 0.8, y: 1.5, w: 7.6, h: 4.65 });
    slide.addText(dashboardBusinessText(chart.insight), { x: 8.75, y: 1.65, w: 3.6, h: 1.35, fontSize: 12, color: '334155', fit: 'shrink' });
    addPptFooter(slide, input);
  });

  if (rankings.length || tables.length || alerts.length) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Ranking y alertas ejecutivas');
    const rankingRows = rankings[0]?.rows ?? tables[0]?.rows ?? [];
    if (rankingRows.length) addPptRows(slide, rankingRows, { x: 0.65, y: 1.25, w: 7.25, h: 4.95, maxRows: 7 });
    if (alerts.length) {
      slide.addShape('roundRect', { x: 8.25, y: 1.25, w: 4.0, h: 4.95, fill: { color: 'FFFBEB' }, line: { color: 'F59E0B', pt: 1 }, radius: 0.12 });
      slide.addText('Alertas', { x: 8.5, y: 1.55, w: 3.5, h: 0.25, fontSize: 13, bold: true, color: '92400E' });
      slide.addText(alerts.slice(0, 5).map((row) => `- ${row.Detalle}`).join('\n'), { x: 8.5, y: 1.95, w: 3.45, h: 3.6, fontSize: 9, color: '92400E', fit: 'shrink' });
    }
    addPptFooter(slide, input);
  }

  if (insights.length || recommendations.length) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Insights y recomendaciones', 'Acciones sugeridas para compras.');
    slide.addText([
      ...insights.slice(0, 5).map((row) => `Insight: ${row.Detalle}`),
      '',
      ...recommendations.slice(0, 6).map((row) => `Recomendacion: ${row.Detalle}`),
    ].join('\n'), { x: 0.7, y: 1.35, w: 11.7, h: 5.1, fontSize: 12, color: '334155', fit: 'shrink', breakLine: false });
    addPptFooter(slide, input);
  }

  await pptx.writeFile({ fileName: getDefaultFileName(input, 'pptx') });
}

async function downloadProposalExportPayloadPptx(input: AgentExportInput, payload: ExportPayload) {
  const pptxgen = (await import('pptxgenjs')).default;
  const pptx = new pptxgen();
  const cleanPayload = { ...payload, blocks: cleanExportBlocks(payload.blocks, 'ppt') };
  const summary = firstExportBlock(cleanPayload, 'summary');
  const decision = proposalMainDecision(cleanPayload);
  const kpis = proposalPayloadKpis(cleanPayload);
  const rankings = proposalPayloadTables(cleanPayload, ['ranking']);
  const matrices = proposalPayloadTables(cleanPayload, ['matrix', 'table']);
  const risks = proposalPayloadRows(cleanPayload, ['risk']);
  const recommendations = proposalPayloadRows(cleanPayload, ['recommendation']);
  const alerts = proposalPayloadRows(cleanPayload, ['alert']);

  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Buyer Nodus';
  pptx.subject = input.agentName || cleanPayload.title;
  pptx.title = cleanPayload.title;
  pptx.company = getBrandName(input.pdfMode ?? 'standard_branded', input.pdfOptions) || 'Buyer Nodus';
  pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'es-PE' };

  let slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
  slide.addText(getBrandName(input.pdfMode ?? 'standard_branded', input.pdfOptions) || 'BUYER NODUS', { x: 0.55, y: 0.35, w: 6, h: 0.25, fontSize: 9, bold: true, color: 'F97316' });
  slide.addText(cleanPayload.title, { x: 0.55, y: 1.0, w: 11.9, h: 0.9, fontSize: 30, bold: true, color: '09008B', fit: 'shrink' });
  if (cleanPayload.subtitle) slide.addText(cleanPayload.subtitle, { x: 0.6, y: 2.12, w: 11.7, h: 0.52, fontSize: 13, color: '334155', fit: 'shrink' });
  if (summary) slide.addText(formatValue(summary.data).slice(0, 3).join('\n'), { x: 0.65, y: 2.95, w: 11.6, h: 1.15, fontSize: 14, color: '334155', fit: 'shrink' });
  addPptFooter(slide, input);

  slide = pptx.addSlide();
  addPptTitle(slide, 'Decision ejecutiva', 'Proveedor recomendado o decision no concluyente segun la informacion disponible.');
  slide.addShape('roundRect', { x: 0.75, y: 1.35, w: 11.7, h: 2.2, fill: { color: asText(decision.Estado, '').toLowerCase().includes('validacion') ? 'FFFBEB' : 'ECFDF5' }, line: { color: 'CBD5E1', pt: 1 }, radius: 0.12 });
  slide.addText(asText(decision.Decision, 'Decision no concluyente'), { x: 1.05, y: 1.65, w: 11.1, h: 0.5, fontSize: 22, bold: true, color: asText(decision.Estado, '').toLowerCase().includes('validacion') ? '92400E' : '166534', fit: 'shrink' });
  slide.addText(asText(decision.Sustento, ''), { x: 1.05, y: 2.28, w: 11.1, h: 0.75, fontSize: 13, color: '334155', fit: 'shrink' });
  addPptFooter(slide, input);

  if (kpis.length) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Indicadores del comparativo', 'Lectura rapida para validar suficiencia y riesgos de decision.');
    addPptKpiCards(slide, kpis.slice(0, 6));
    addPptFooter(slide, input);
  }

  if (rankings[0]?.rows.length) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Ranking visual de proveedores', 'Semaforo ejecutivo para priorizar decision y negociacion.');
    addPptProposalTable(slide, rankings[0].rows, { maxRows: Math.min(rankings[0].rows.length, 7), fontSize: 7.5 });
    addPptFooter(slide, input);
  }

  if (matrices[0]?.rows.length) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Matriz comparativa resumida', 'Criterios principales para comparar precio, plazo, condiciones, garantia y riesgos.');
    addPptProposalTable(slide, matrices[0].rows, { maxRows: Math.min(matrices[0].rows.length, 8), fontSize: 6.6 });
    addPptFooter(slide, input);
  }

  if (risks.length || recommendations.length || alerts.length) {
    slide = pptx.addSlide();
    addPptTitle(slide, 'Riesgos y recomendaciones de negociacion', 'Acciones sugeridas antes de adjudicar.');
    slide.addText([
      ...risks.slice(0, 4).map((row) => `Riesgo: ${row.Detalle}`),
      '',
      ...recommendations.slice(0, 5).map((row) => `Recomendacion: ${row.Detalle}`),
      '',
      ...alerts.slice(0, 3).map((row) => `Pendiente: ${row.Detalle}`),
    ].filter((item) => item !== undefined).join('\n'), { x: 0.75, y: 1.35, w: 11.65, h: 5.05, fontSize: 12, color: '334155', fit: 'shrink', breakLine: false });
    addPptFooter(slide, input);
  }

  await pptx.writeFile({ fileName: getDefaultFileName(input, 'pptx') });
}

async function downloadExportPayloadPptx(input: AgentExportInput, payload: ExportPayload) {
  if (isDashboardExportPayload(payload)) {
    await downloadDashboardExportPayloadPptx(input, payload);
    return;
  }
  if (isProposalExportPayload(payload)) {
    await downloadProposalExportPayloadPptx(input, payload);
    return;
  }
  const pptxgen = (await import('pptxgenjs')).default;
  const pptx = new pptxgen();
  const cleanPayload = { ...payload, blocks: cleanExportBlocks(payload.blocks, 'ppt') };
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Buyer Nodus';
  pptx.subject = input.agentName || cleanPayload.title;
  pptx.title = cleanPayload.title;
  pptx.company = getBrandName(input.pdfMode ?? 'standard_branded', input.pdfOptions) || 'Buyer Nodus';
  pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'es-PE' };

  let slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
  slide.addText(getBrandName(input.pdfMode ?? 'standard_branded', input.pdfOptions) || 'BUYER NODUS', { x: 0.55, y: 0.35, w: 6, h: 0.25, fontSize: 9, bold: true, color: '09008B' });
  slide.addText(cleanPayload.title, { x: 0.55, y: 1.0, w: 11.9, h: 0.9, fontSize: 29, bold: true, color: '09008B', fit: 'shrink' });
  if (cleanPayload.subtitle) slide.addText(cleanPayload.subtitle, { x: 0.6, y: 2.15, w: 11.7, h: 0.5, fontSize: 13, color: '334155', fit: 'shrink' });
  addPptFooter(slide, input);

  cleanPayload.blocks.forEach((block) => {
    const title = block.title || blockLabel(block.type);
    if (block.type === 'kpi') {
      const kpis = asArray(block.data).map(asRecord);
      if (!kpis.length) return;
      slide = pptx.addSlide();
      addPptTitle(slide, title, block.description);
      addPptKpiCards(slide, kpis.slice(0, 6));
      addPptFooter(slide, input);
      return;
    }
    if (block.type === 'chart') {
      asArray(block.data).map(asRecord).slice(0, 3).forEach((chart) => {
        slide = pptx.addSlide();
        addPptTitle(slide, asText(chart.title, title), asText(chart.description || block.description, ''));
        addPptChartVisual(slide, chart, { x: 0.75, y: 1.45, w: 7.7, h: 4.7 });
        slide.addText(asText(chart.insight, ''), { x: 8.75, y: 1.55, w: 3.7, h: 1.2, fontSize: 12, color: '334155', fit: 'shrink' });
        addPptFooter(slide, input);
      });
      return;
    }

    const tables = exportTableBlocks(block);
    if (tables.length && !['summary', 'decision', 'recommendation', 'risk', 'alert', 'insight'].includes(block.type)) {
      tables.slice(0, 2).forEach((table) => {
        slide = pptx.addSlide();
        addPptTitle(slide, table.title, block.description);
        addPptRows(slide, table.rows, { maxRows: Math.min(table.rows.length, 8) });
        addPptFooter(slide, input);
      });
      return;
    }

    const rows = exportBlockRows(block);
    if (!rows.length) return;
    slide = pptx.addSlide();
    addPptTitle(slide, title, block.description);
    slide.addText(rows.slice(0, 8).map((row) => Object.values(row).map((value) => asText(value, '')).filter(Boolean).join(': ')).join('\n'), {
      x: 0.65,
      y: 1.35,
      w: 11.8,
      h: 5.3,
      fontSize: block.type === 'decision' ? 16 : 12,
      color: block.type === 'alert' || block.type === 'risk' ? '92400E' : '334155',
      fit: 'shrink',
      breakLine: false,
    });
    addPptFooter(slide, input);
  });

  await pptx.writeFile({ fileName: getDefaultFileName(input, 'pptx') });
}

export async function downloadAgentResultPdf(input: PdfInput) {
  if (isExportPayload(input.result)) {
    addExportPayloadPdf(input, input.result);
    return;
  }
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
  const exportFormat = mapAgentExportFormat(input.format);
  const initialPayload = exportFormat
    ? buildExportPayload(input.agentKey, input.result, { termsScope: input.termsScope })
    : undefined;
  const qualityReport = auditDeliverableBeforeDownload({
    agentKey: input.agentKey,
    result: initialPayload ?? input.result,
    options: { termsScope: input.termsScope },
  });
  assertDeliverableCanDownload(qualityReport);
  if (exportFormat) {
    const payload = {
      ...qualityReport.sanitizedPayload,
      blocks: cleanExportBlocks(qualityReport.sanitizedPayload.blocks, exportFormat),
    };
    const formatQualityReport = auditDeliverableBeforeDownload({
      agentKey: input.agentKey,
      result: payload,
      options: { termsScope: input.termsScope },
    });
    assertDeliverableCanDownload(formatQualityReport);
    const formatPayload = formatQualityReport.sanitizedPayload;
    if (input.format === 'pdf') {
      addExportPayloadPdf({ ...input, result: formatPayload, fileName: getDefaultFileName(input, 'pdf') }, formatPayload, exportFormat);
      return;
    }
    if (input.format === 'pptx') {
      await downloadExportPayloadPptx({ ...input, result: formatPayload }, formatPayload);
      return;
    }
    if (input.format === 'xlsx') {
      await downloadExportPayloadXlsx({ ...input, result: formatPayload }, formatPayload);
      return;
    }
  }
  const auditedInput: AgentExportInput = {
    ...input,
    result: qualityReport.sanitizedContent,
  };
  if (input.format === 'pdf') {
    await downloadAgentResultPdf({ ...auditedInput, fileName: getDefaultFileName(auditedInput, 'pdf') });
    return;
  }
  if (input.format === 'docx') {
    await downloadAgentResultDocx(auditedInput);
    return;
  }
  if (input.format === 'pptx') {
    await downloadAgentResultPptx(auditedInput);
    return;
  }
  await downloadAgentResultXlsx(auditedInput);
}

