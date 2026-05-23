import jsPDF from 'jspdf';

export type DashboardKpi = {
  title: string;
  value: string;
  description: string;
  calculation_logic: string;
  source: 'python' | 'llm_structured_from_documents';
  confidence: 'low' | 'medium' | 'high';
};

export type DashboardChart = {
  chart_id: string;
  title: string;
  type: 'bar' | 'horizontal_bar' | 'line' | 'area' | 'pie' | 'donut' | 'stacked_bar' | 'table' | 'kpi' | 'matrix' | 'alert';
  description: string;
  x_axis: string | null;
  y_axis: string | null;
  data: Array<{ label: string; value: number; group?: string | null }>;
  data_source: 'python_calculated' | 'llm_structured' | 'suggested';
  confidence: 'low' | 'medium' | 'high';
  insight: string;
};

export type DashboardObservation = {
  title: string;
  description: string;
  type: 'opportunity' | 'risk' | 'warning' | 'trend' | 'data_quality';
};

export type DashboardResult = {
  dashboard_title: string;
  objective: string;
  audience: string | null;
  period: string | null;
  data_type: string | null;
  analysis_mode: 'structured_data' | 'document_based' | 'mixed';
  confidence_level: 'low' | 'medium' | 'high';
  executive_summary: string;
  llm_used: boolean;
  data_understanding: {
    files_processed: number;
    source_types: string[];
    detected_analysis_type: 'gastos' | 'proveedores' | 'compras' | 'contratos' | 'inventario' | 'cotizaciones' | 'cumplimiento' | 'financiero' | 'mixto';
    structure_level: 'high' | 'medium' | 'low';
    notes: string[];
  };
  data_profile: {
    files_processed: number;
    rows_detected: number;
    columns_detected: number;
    detected_columns: string[];
    date_columns: string[];
    numeric_columns: string[];
    category_columns: string[];
    data_quality_warnings: string[];
  };
  kpis: DashboardKpi[];
  charts: DashboardChart[];
  tables: Array<{ title: string; description: string; source: 'python' | 'llm_structured_from_documents'; columns: string[]; rows: Array<Record<string, unknown>> }>;
  insights: Array<{ title: string; description: string; impact: 'low' | 'medium' | 'high'; recommended_action: string }>;
  observations: DashboardObservation[];
  recommendations: string[];
  missing_information: string[];
  document_summaries: Array<{
    file_name: string;
    detected_type: string;
    text_preview?: string | null;
    relevant_findings: string[];
    limitations: string[];
  }>;
  source_files: Array<{ file_name: string; detected_type: string }>;
  suggested_filters: string[];
  layout_suggestion: Array<Record<string, unknown>>;
  pdf_available: boolean;
  model_provider?: string | null;
  model_name?: string | null;
  latency_ms?: number | null;
  disclaimer: string;
};

export type GenerateDashboardPayload = {
  title: string;
  objective: string;
  audience?: string;
  period?: string;
  dataType?: string;
  visualizationFocus?: string;
  additionalContext?: string;
  useLlmInsights?: boolean;
  files: File[];
};

const DEFAULT_AI_ENGINE_URL = '/ai-engine';

function getAiEngineBaseUrl() {
  const configuredUrl = import.meta.env.VITE_AI_ENGINE_URL?.trim();
  return (configuredUrl || DEFAULT_AI_ENGINE_URL).replace(/\/$/, '');
}

async function readError(response: Response, fallback: string) {
  try {
    const data = (await response.clone().json()) as { detail?: unknown; message?: unknown };
    if (typeof data.detail === 'string') return data.detail;
    if (typeof data.message === 'string') return data.message;
    if (Array.isArray(data.detail)) {
      return data.detail
        .map((item) => {
          if (item && typeof item === 'object' && 'msg' in item) return String((item as { msg: unknown }).msg);
          return String(item);
        })
        .join(' ');
    }
  } catch {
    const text = await response.text().catch(() => '');
    return text.trim().slice(0, 220) || response.statusText || fallback;
  }
  return fallback;
}

export async function generateDashboard(payload: GenerateDashboardPayload): Promise<DashboardResult> {
  const formData = new FormData();
  formData.append('title', payload.title);
  formData.append('objective', payload.objective);
  formData.append('use_llm_insights', String(payload.useLlmInsights ?? false));
  if (payload.audience?.trim()) formData.append('audience', payload.audience.trim());
  if (payload.period?.trim()) formData.append('period', payload.period.trim());
  if (payload.dataType?.trim()) formData.append('data_type', payload.dataType.trim());
  if (payload.visualizationFocus?.trim()) formData.append('visualization_focus', payload.visualizationFocus.trim());
  if (payload.additionalContext?.trim()) formData.append('additional_context', payload.additionalContext.trim());
  payload.files.forEach((file) => formData.append('files', file, file.name));

  let response: Response;
  try {
    response = await fetch(`${getAiEngineBaseUrl()}/agents/dashboard-creator/generate`, {
      method: 'POST',
      body: formData,
    });
  } catch {
    throw new Error('No se pudo conectar con el motor de IA.');
  }

  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo generar el dashboard.'));
  }

  return response.json() as Promise<DashboardResult>;
}

export async function downloadDashboardPdf(input: {
  result: DashboardResult;
  pdfMode?: string;
  branding?: Record<string, unknown>;
}) {
  downloadVisualDashboardPdf(input.result, input.pdfMode, input.branding);
}

type PdfCtx = {
  doc: jsPDF;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  y: number;
  primary: string;
};

function textValue(value: unknown, fallback = 'No especificado') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function addPageIfNeeded(ctx: PdfCtx, height = 16) {
  if (ctx.y + height <= ctx.pageHeight - 14) return;
  ctx.doc.addPage();
  ctx.y = 16;
}

function addWrappedText(ctx: PdfCtx, text: string, x: number, y: number, width: number, options: { size?: number; bold?: boolean; color?: string; lineHeight?: number } = {}) {
  ctx.doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
  ctx.doc.setFontSize(options.size ?? 8);
  ctx.doc.setTextColor(options.color ?? '#334155');
  const lines = ctx.doc.splitTextToSize(text, width);
  ctx.doc.text(lines, x, y);
  return lines.length * (options.lineHeight ?? 4.2);
}

function sectionTitle(ctx: PdfCtx, title: string) {
  addPageIfNeeded(ctx, 14);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(11);
  ctx.doc.setTextColor(ctx.primary);
  ctx.doc.text(title, ctx.margin, ctx.y);
  ctx.y += 8;
}

function roundedCard(ctx: PdfCtx, x: number, y: number, width: number, height: number, fill = '#ffffff') {
  ctx.doc.setFillColor(fill);
  ctx.doc.setDrawColor('#cfd4f6');
  ctx.doc.roundedRect(x, y, width, height, 2.8, 2.8, 'FD');
}

function drawHeader(ctx: PdfCtx, result: DashboardResult, pdfMode?: string, branding?: Record<string, unknown>) {
  const brand = pdfMode === 'white_label' ? '' : String(branding?.company_name || branding?.custom_brand_name || 'Buyer Nodus');
  if (brand) {
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(9);
    ctx.doc.setTextColor(ctx.primary);
    ctx.doc.text(brand, ctx.margin, ctx.y);
    ctx.y += 7;
  }
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(16);
  ctx.doc.setTextColor('#09008B');
  const titleLines = ctx.doc.splitTextToSize(result.dashboard_title || 'Creador de Dashboard', ctx.pageWidth - ctx.margin * 2);
  ctx.doc.text(titleLines, ctx.margin, ctx.y);
  ctx.y += titleLines.length * 7 + 2;
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(8.5);
  ctx.doc.setTextColor('#64748b');
  ctx.doc.text(new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()), ctx.margin, ctx.y);
  ctx.y += 8;
}

function drawKpis(ctx: PdfCtx, kpis: DashboardKpi[]) {
  if (!kpis.length) return;
  sectionTitle(ctx, 'KPIs principales');
  const gap = 4;
  const columns = 4;
  const width = (ctx.pageWidth - ctx.margin * 2 - gap * (columns - 1)) / columns;
  const height = 31;
  kpis.forEach((kpi, index) => {
    const col = index % columns;
    if (col === 0) addPageIfNeeded(ctx, height + 8);
    const x = ctx.margin + col * (width + gap);
    const y = ctx.y;
    roundedCard(ctx, x, y, width, height);
    addWrappedText(ctx, kpi.title.toUpperCase(), x + 3, y + 6, width - 6, { size: 5.8, bold: true, color: '#6b63d9', lineHeight: 3 });
    addWrappedText(ctx, textValue(kpi.value), x + 3, y + 14, width - 6, { size: 10.5, bold: true, color: '#09008B', lineHeight: 5 });
    addWrappedText(ctx, kpi.description, x + 3, y + 22, width - 6, { size: 5.6, color: '#6870c5', lineHeight: 3 });
    if (col === columns - 1 || index === kpis.length - 1) ctx.y += height + 5;
  });
}

function drawCharts(ctx: PdfCtx, charts: DashboardChart[]) {
  if (!charts.length) return;
  sectionTitle(ctx, 'Gráficos');
  const gap = 5;
  const width = (ctx.pageWidth - ctx.margin * 2 - gap) / 2;
  charts.forEach((chart, index) => {
    const max = Math.max(...chart.data.map((item) => Number(item.value) || 0), 1);
    const rows = chart.data.slice(0, 10);
    const height = Math.max(46, 24 + rows.length * 8);
    if (index % 2 === 0) addPageIfNeeded(ctx, height + 8);
    const x = ctx.margin + (index % 2) * (width + gap);
    const y = ctx.y;
    roundedCard(ctx, x, y, width, height);
    addWrappedText(ctx, chart.title, x + 3, y + 7, width - 20, { size: 8, bold: true, color: '#09008B' });
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(5.8);
    ctx.doc.setTextColor('#09008B');
    ctx.doc.roundedRect(x + width - 14, y + 3, 11, 5, 2, 2);
    ctx.doc.text(chart.type, x + width - 11.5, y + 6.6);
    addWrappedText(ctx, chart.description, x + 3, y + 13, width - 6, { size: 5.8, color: '#6870c5', lineHeight: 3 });
    let rowY = y + 23;
    rows.forEach((item) => {
      const barWidth = Math.max(4, ((Number(item.value) || 0) / max) * (width - 16));
      ctx.doc.setFont('helvetica', 'normal');
      ctx.doc.setFontSize(5.7);
      ctx.doc.setTextColor('#334155');
      ctx.doc.text(textValue(item.label).slice(0, 36), x + 3, rowY);
      ctx.doc.text(Number(item.value).toLocaleString('es-PE'), x + width - 3, rowY, { align: 'right' });
      ctx.doc.setFillColor('#e7e8f8');
      ctx.doc.roundedRect(x + 3, rowY + 2, width - 8, 2.2, 1, 1, 'F');
      ctx.doc.setFillColor('#09008B');
      ctx.doc.roundedRect(x + 3, rowY + 2, barWidth, 2.2, 1, 1, 'F');
      rowY += 7.8;
    });
    addWrappedText(ctx, chart.insight, x + 3, y + height - 7, width - 6, { size: 5.7, color: '#6870c5', lineHeight: 3 });
    if (index % 2 === 1 || index === charts.length - 1) ctx.y += height + 5;
  });
}

function drawTables(ctx: PdfCtx, tables: DashboardResult['tables']) {
  if (!tables.length) return;
  sectionTitle(ctx, 'Tablas');
  tables.forEach((table) => {
    addPageIfNeeded(ctx, 40);
    addWrappedText(ctx, table.title, ctx.margin, ctx.y, ctx.pageWidth - ctx.margin * 2, { size: 8.5, bold: true, color: '#09008B' });
    ctx.y += 5;
    addWrappedText(ctx, table.description, ctx.margin, ctx.y, ctx.pageWidth - ctx.margin * 2, { size: 6.2, color: '#64748b' });
    ctx.y += 5;
    const columns = table.columns.slice(0, 5);
    const colWidth = (ctx.pageWidth - ctx.margin * 2) / Math.max(columns.length, 1);
    ctx.doc.setFillColor('#eef2ff');
    ctx.doc.rect(ctx.margin, ctx.y, ctx.pageWidth - ctx.margin * 2, 7, 'F');
    columns.forEach((column, index) => addWrappedText(ctx, column, ctx.margin + index * colWidth + 1.5, ctx.y + 4.8, colWidth - 3, { size: 5.8, bold: true, color: '#09008B' }));
    ctx.y += 7;
    table.rows.slice(0, 10).forEach((row) => {
      addPageIfNeeded(ctx, 8);
      columns.forEach((column, index) => addWrappedText(ctx, textValue(row[column], ''), ctx.margin + index * colWidth + 1.5, ctx.y + 4.5, colWidth - 3, { size: 5.8, color: '#334155' }));
      ctx.y += 8;
    });
    ctx.y += 5;
  });
}

function drawTextBlocks(ctx: PdfCtx, title: string, items: Array<{ title?: string; description?: string; recommended_action?: string } | string>) {
  if (!items.length) return;
  sectionTitle(ctx, title);
  items.forEach((item) => {
    addPageIfNeeded(ctx, 22);
    const heading = typeof item === 'string' ? '' : item.title;
    const body = typeof item === 'string' ? item : [item.description, item.recommended_action ? `Acción: ${item.recommended_action}` : ''].filter(Boolean).join(' ');
    roundedCard(ctx, ctx.margin, ctx.y, ctx.pageWidth - ctx.margin * 2, 20, '#f8f9ff');
    if (heading) addWrappedText(ctx, heading, ctx.margin + 4, ctx.y + 6, ctx.pageWidth - ctx.margin * 2 - 8, { size: 7.2, bold: true, color: '#09008B' });
    addWrappedText(ctx, body, ctx.margin + 4, ctx.y + (heading ? 12 : 7), ctx.pageWidth - ctx.margin * 2 - 8, { size: 6.4, color: '#475569' });
    ctx.y += 24;
  });
}

function drawQuality(ctx: PdfCtx, result: DashboardResult) {
  sectionTitle(ctx, 'Calidad de datos e información faltante');
  roundedCard(ctx, ctx.margin, ctx.y, ctx.pageWidth - ctx.margin * 2, 28, '#ffffff');
  const text = `${result.data_profile.rows_detected} filas, ${result.data_profile.columns_detected} columnas, ${result.data_profile.files_processed} archivo(s).`;
  addWrappedText(ctx, text, ctx.margin + 4, ctx.y + 7, ctx.pageWidth - ctx.margin * 2 - 8, { size: 7.2, bold: true, color: '#09008B' });
  addWrappedText(ctx, [...result.data_profile.data_quality_warnings, ...result.suggested_filters, ...result.missing_information].join(' | ') || 'Sin alertas adicionales.', ctx.margin + 4, ctx.y + 15, ctx.pageWidth - ctx.margin * 2 - 8, { size: 6.2, color: '#475569' });
  ctx.y += 34;
}

function downloadVisualDashboardPdf(result: DashboardResult, pdfMode?: string, branding?: Record<string, unknown>) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ctx: PdfCtx = {
    doc,
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
    margin: 10,
    y: 14,
    primary: String(branding?.primary_color || branding?.custom_primary_color || '#09008B'),
  };

  drawHeader(ctx, result, pdfMode, branding);
  if (result.executive_summary) {
    roundedCard(ctx, ctx.margin, ctx.y, ctx.pageWidth - ctx.margin * 2, 26, '#eef2ff');
    addWrappedText(ctx, 'Resumen ejecutivo', ctx.margin + 4, ctx.y + 7, ctx.pageWidth - ctx.margin * 2 - 8, { size: 8, bold: true, color: '#09008B' });
    addWrappedText(ctx, result.executive_summary, ctx.margin + 4, ctx.y + 14, ctx.pageWidth - ctx.margin * 2 - 8, { size: 6.5, color: '#334155' });
    ctx.y += 32;
  }
  drawKpis(ctx, result.kpis);
  drawCharts(ctx, result.charts);
  drawTables(ctx, result.tables);
  drawTextBlocks(ctx, 'Insights detectados', result.insights);
  drawTextBlocks(ctx, 'Observaciones', result.observations);
  drawTextBlocks(ctx, 'Recomendaciones', result.recommendations);
  drawQuality(ctx, result);
  if (result.disclaimer) {
    addWrappedText(ctx, result.disclaimer, ctx.margin, ctx.y, ctx.pageWidth - ctx.margin * 2, { size: 6.2, color: '#64748b' });
  }
  doc.save('dashboard-nodus-ia.pdf');
}
