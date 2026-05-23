export type DashboardKpi = {
  title: string;
  value: string;
  description: string;
  calculation_logic: string;
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
  insight: string;
};

export type DashboardResult = {
  dashboard_title: string;
  objective: string;
  audience: string | null;
  period: string | null;
  data_type: string | null;
  executive_summary: string;
  llm_used: boolean;
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
  tables: Array<{ title: string; description: string; columns: string[]; rows: Array<Record<string, unknown>> }>;
  insights: Array<{ title: string; description: string; impact: 'low' | 'medium' | 'high'; recommended_action: string }>;
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
  formData.append('use_llm_insights', String(payload.useLlmInsights ?? true));
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
  const response = await fetch(`${getAiEngineBaseUrl()}/agents/dashboard-creator/generate-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: input.result, pdf_mode: input.pdfMode, branding: input.branding }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, 'No se pudo descargar el PDF.'));
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'dashboard-nodus-ia.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
