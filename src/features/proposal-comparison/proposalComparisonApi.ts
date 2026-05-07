export type ProposalComparisonCriterion = {
  name: string;
  weight: number;
};

export type ProposalComparisonRankingItem = {
  position: number;
  supplier_name: string;
  score: number;
  reason: string;
  main_strengths: string[];
  main_risks: string[];
};

export type ProposalComparisonSupplier = {
  supplier_name: string;
  ruc: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  proposal_date: string | null;
  validity: string | null;
  total_amount: string | null;
  currency: string | null;
  price_type: string | null;
  payment_terms: string | null;
  contract_minimum: string | null;
  warranty: string | null;
  certifications: string[];
  included_services: string[];
  excluded_services: string[];
  observations: string[];
  strengths: string[];
  risks: string[];
  missing_information: string[];
};

export type ProposalComparisonRow = {
  criterion: string;
  values: Record<string, string | null>;
  comment: string;
};

export type ProposalComparisonResult = {
  analysis_title: string;
  service: string;
  objective: string | null;
  executive_summary: string;
  recommended_supplier: string;
  ranking: ProposalComparisonRankingItem[];
  suppliers: ProposalComparisonSupplier[];
  comparison_table: ProposalComparisonRow[];
  global_risks: string[];
  missing_information: string[];
  questions_for_suppliers: string[];
  final_recommendation: string;
  disclaimer: string;
};

export type AnalyzeProposalComparisonPayload = {
  title?: string;
  service: string;
  objective?: string;
  criteria: ProposalComparisonCriterion[];
  files: File[];
};

const DEFAULT_AI_ENGINE_URL = '/ai-engine';

function getAiEngineBaseUrl() {
  const configuredUrl = import.meta.env.VITE_AI_ENGINE_URL?.trim();
  return (configuredUrl || DEFAULT_AI_ENGINE_URL).replace(/\/$/, '');
}

function getFriendlyErrorMessage(message: string) {
  if (message.toLowerCase().includes('failed to fetch')) {
    return 'No se pudo conectar con el AI Engine. Verifica que la plataforma esté levantada en http://localhost:5173/ y que el motor interno esté activo.';
  }

  return message || 'No se pudo analizar las propuestas. Intenta nuevamente.';
}

export async function analyzeProposalComparison(
  payload: AnalyzeProposalComparisonPayload,
): Promise<ProposalComparisonResult> {
  const formData = new FormData();
  formData.append('title', payload.title || 'Comparativo de propuestas de proveedores');
  formData.append('service', payload.service);

  if (payload.objective?.trim()) {
    formData.append('objective', payload.objective.trim());
  }

  formData.append('criteria', JSON.stringify(payload.criteria));
  payload.files.forEach((file) => formData.append('files', file, file.name));

  let response: Response;

  try {
    response = await fetch(`${getAiEngineBaseUrl()}/agents/proposal-comparison/analyze`, {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    throw new Error(getFriendlyErrorMessage(error instanceof Error ? error.message : ''));
  }

  if (!response.ok) {
    let message = 'No se pudo analizar las propuestas.';

    try {
      const data = (await response.json()) as { detail?: unknown; message?: unknown };
      if (typeof data.detail === 'string') {
        message = data.detail;
      } else if (Array.isArray(data.detail)) {
        message = data.detail
          .map((item) =>
            typeof item === 'object' && item && 'msg' in item
              ? String((item as { msg: unknown }).msg)
              : String(item),
          )
          .join(', ');
      } else if (typeof data.message === 'string') {
        message = data.message;
      }
    } catch {
      message = response.statusText || message;
    }

    throw new Error(getFriendlyErrorMessage(message));
  }

  return response.json() as Promise<ProposalComparisonResult>;
}
