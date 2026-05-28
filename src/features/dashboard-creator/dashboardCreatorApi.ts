export type DashboardKpi = {
  title: string;
  value: string;
  description: string;
  calculation_logic: string;
  source: 'python' | 'backend' | 'calculated' | 'llm_structured_from_documents';
  confidence: 'low' | 'medium' | 'high';
  unit?: string | null;
  status?: 'positive' | 'warning' | 'critical' | 'neutral';
  evidence_refs?: string[];
};

export type DashboardChart = {
  chart_id: string;
  title: string;
  type: 'bar' | 'horizontal_bar' | 'line' | 'area' | 'pie' | 'donut' | 'stacked_bar' | 'table' | 'kpi' | 'matrix' | 'alert';
  description: string;
  x_axis: string | null;
  y_axis: string | null;
  data: Array<{ label: string; value: number; group?: string | null }>;
  legend?: Array<{ label: string; value?: string | null; color?: string | null }>;
  colors?: string[];
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
  metadata?: {
    title?: string | null;
    report_name?: string | null;
    created_from?: string;
    agent_name?: string;
    agent_key?: string;
    user?: string | null;
    generated_at?: string | null;
    analyzed_files?: Array<Record<string, unknown>>;
  } | null;
  dashboard_title: string;
  objective: string;
  audience: string | null;
  period: string | null;
  data_type: string | null;
  analysis_mode: 'structured_data' | 'document_based' | 'mixed';
  confidence_level: 'low' | 'medium' | 'high';
  confidence_reason?: string | null;
  executive_summary: string;
  executiveSummary?: {
    information_found?: string | null;
    analysis_built?: string | null;
    main_indicators?: string[];
    limitations?: string[];
  } | null;
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
    files?: Array<Record<string, unknown>>;
    columns?: Array<Record<string, unknown>>;
    candidateFields?: Record<string, string[]>;
    rowSamples?: Array<Record<string, unknown>>;
    basicStats?: Record<string, unknown>;
    possibleAnalyses?: Array<Record<string, unknown>>;
    notPossibleAnalyses?: Array<Record<string, unknown>>;
    confidence?: 'low' | 'medium' | 'high';
  };
  dataProfile?: DashboardResult['data_profile'];
  dashboardPlan?: Record<string, unknown> | null;
  kpis: DashboardKpi[];
  charts: DashboardChart[];
  tables: Array<{ title: string; description: string; source: 'python' | 'backend' | 'calculated' | 'llm_structured_from_documents'; columns: string[]; rows: Array<Record<string, unknown>>; observations?: string[] }>;
  findings?: Array<{ title: string; description: string; evidence?: string | null; source_component?: string | null; confidence?: 'low' | 'medium' | 'high'; inferred?: boolean }>;
  insights: Array<{ title: string; description: string; impact: 'low' | 'medium' | 'high'; recommended_action: string }>;
  observations: DashboardObservation[];
  recommendations: string[];
  missing_information: string[];
  missingData?: Array<{ indicator: string; reason: string; required_fields?: string[] }>;
  qualityWarnings?: string[];
  visualConfig?: {
    background?: string;
    primary?: string;
    secondary?: string;
    danger?: string;
    success?: string;
  };
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
  dashboardName?: string;
  objective: string;
  objectiveInstructions?: string;
  audience?: string;
  period?: string;
  dataType?: string;
  visualizationFocus?: string;
  dashboardFocus?: string;
  additionalContext?: string;
  useLlmInsights?: boolean;
  files: File[];
  onProgress?: (event: { stage: 'uploading_files' | 'reading_files'; uploadPercent?: number }) => void;
};

const DEFAULT_AI_ENGINE_URL = '/ai-engine';

function getAiEngineBaseUrl() {
  const configuredUrl = import.meta.env.VITE_AI_ENGINE_URL?.trim();
  return (configuredUrl || DEFAULT_AI_ENGINE_URL).replace(/\/$/, '');
}

export async function generateDashboard(payload: GenerateDashboardPayload): Promise<DashboardResult> {
  const formData = new FormData();
  formData.append('title', (payload.dashboardName || payload.title).trim());
  formData.append('objective', (payload.objectiveInstructions || payload.objective).trim());
  formData.append('use_llm_insights', String(payload.useLlmInsights ?? false));
  if (payload.audience?.trim()) formData.append('audience', payload.audience.trim());
  if (payload.period?.trim()) formData.append('period', payload.period.trim());
  if (payload.dataType?.trim()) formData.append('data_type', payload.dataType.trim());
  const focus = payload.dashboardFocus || payload.visualizationFocus;
  if (focus?.trim()) formData.append('visualization_focus', focus.trim());
  if (payload.additionalContext?.trim()) formData.append('additional_context', payload.additionalContext.trim());
  payload.files.forEach((file) => formData.append('files', file, file.name));

  payload.onProgress?.({ stage: 'uploading_files', uploadPercent: 0 });

  return new Promise<DashboardResult>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${getAiEngineBaseUrl()}/agents/dashboard-creator/generate`);
    request.responseType = 'text';

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        payload.onProgress?.({ stage: 'uploading_files' });
        return;
      }
      payload.onProgress?.({
        stage: 'uploading_files',
        uploadPercent: Math.round((event.loaded / event.total) * 100),
      });
    };

    request.upload.onload = () => {
      payload.onProgress?.({ stage: 'reading_files', uploadPercent: 100 });
    };

    request.onerror = () => reject(new Error('No se pudo conectar con el motor de IA.'));
    request.ontimeout = () => reject(new Error('El análisis tomó más tiempo de lo esperado.'));
    request.onload = () => {
      const responseText = request.responseText || '';
      if (request.status < 200 || request.status >= 300) {
        try {
          const data = JSON.parse(responseText) as { detail?: unknown; message?: unknown };
          if (typeof data.detail === 'string') {
            reject(new Error(data.detail));
            return;
          }
          if (typeof data.message === 'string') {
            reject(new Error(data.message));
            return;
          }
          if (Array.isArray(data.detail)) {
            reject(new Error(data.detail.map((item) => (item && typeof item === 'object' && 'msg' in item ? String((item as { msg: unknown }).msg) : String(item))).join(' ')));
            return;
          }
        } catch {
          reject(new Error(responseText.trim().slice(0, 220) || 'No se pudo generar el dashboard.'));
          return;
        }
        reject(new Error('No se pudo generar el dashboard.'));
        return;
      }

      try {
        resolve(JSON.parse(responseText) as DashboardResult);
      } catch {
        reject(new Error('No se pudo leer el resultado del dashboard.'));
      }
    };

    request.send(formData);
  });
}
