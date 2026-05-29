import { ApiRequestError, apiRequest, getApiUrl, getStoredToken } from '@/lib/api';

const AI_ENGINE_UNAVAILABLE_MESSAGE =
  'No se pudo conectar con el motor de IA. Intenta nuevamente en unos minutos.';

export type AgentRunErrorType =
  | 'file_validation_error'
  | 'insufficient_data'
  | 'quality_gate_blocked'
  | 'user_permission_required'
  | 'backend_error'
  | 'ai_engine_error'
  | 'network_error'
  | 'unauthorized'
  | 'module_not_active'
  | 'unknown_error';

type AgentRunResponse<T> = {
  ok?: boolean;
  errorCode?: string | null;
  message?: string;
  traceId?: string;
  runId?: string;
  agentRunId?: string;
  execution: {
    outputData?: T;
  } | null;
};

export class AgentRunError extends Error {
  type: AgentRunErrorType;
  status?: number;
  errorCode?: string | null;
  traceId?: string;
  runId?: string;

  constructor(message: string, options: {
    type?: AgentRunErrorType;
    status?: number;
    errorCode?: string | null;
    traceId?: string;
    runId?: string;
  } = {}) {
    super(message);
    this.name = 'AgentRunError';
    this.type = options.type ?? classifyAgentRunError({
      message,
      status: options.status,
      errorCode: options.errorCode,
    });
    this.status = options.status;
    this.errorCode = options.errorCode;
    this.traceId = options.traceId;
    this.runId = options.runId;
  }
}

export function classifyAgentRunError(input: {
  message?: string;
  status?: number;
  errorCode?: string | null;
}): AgentRunErrorType {
  const normalized = `${input.errorCode ?? ''} ${input.message ?? ''}`.toLowerCase();

  if (input.status === 401) return 'unauthorized';
  if (input.status === 403 && /module|m[oó]dulo|habilitad|active|activation/.test(normalized)) return 'module_not_active';
  if (input.status === 403) return 'unauthorized';
  if (/module_not_active|module-disabled|not active|no habilitad|m[oó]dulo/.test(normalized)) return 'module_not_active';
  if (/file|archivo|format|formato|corrupt|ilegible|empty|vac[ií]o|unsupported/.test(normalized)) return 'file_validation_error';
  if (/insufficient|suficiente|faltan|faltante|missing|required|required_data|no data|sin datos|no se detectaron|alternativas|costos/.test(normalized)) return 'insufficient_data';
  if (/quality_gate|quality gate|blocked|bloqueado|false or misleading|engañoso|enganoso/.test(normalized)) return 'quality_gate_blocked';
  if (/permission|permiso|override|responsabilidad/.test(normalized)) return 'user_permission_required';
  if (/timeout|time out|ai engine|motor|model|modelo|provider|llm|no respondi[oó]|unavailable/.test(normalized)) return 'ai_engine_error';
  if (/failed to fetch|network|conectar|connection|cors|backend publicado/.test(normalized)) return 'network_error';
  if (input.status && input.status >= 500) return 'backend_error';
  return 'unknown_error';
}

function agentRunErrorFromApiError(error: ApiRequestError) {
  return new AgentRunError(error.message || AI_ENGINE_UNAVAILABLE_MESSAGE, {
    status: error.status,
    errorCode: error.errorCode,
    traceId: error.traceId,
    runId: error.runId,
  });
}

function agentRunErrorFromResponse<T>(response: AgentRunResponse<T> | undefined | null) {
  const message = response?.message || AI_ENGINE_UNAVAILABLE_MESSAGE;
  return new AgentRunError(message, {
    errorCode: response?.errorCode,
    traceId: response?.traceId,
    runId: response?.runId || response?.agentRunId,
  });
}

export async function runAiAgent<T>(formData: FormData): Promise<T> {
  let response: AgentRunResponse<T>;

  try {
    response = await apiRequest<AgentRunResponse<T>>('/agents/run', {
      method: 'POST',
      auth: true,
      cache: 'no-store',
      body: formData,
    });
  } catch (error) {
    if (error instanceof AgentRunError) throw error;
    if (error instanceof ApiRequestError) throw agentRunErrorFromApiError(error);
    throw new AgentRunError(error instanceof Error ? error.message : AI_ENGINE_UNAVAILABLE_MESSAGE);
  }

  if (!response?.ok || !response.execution?.outputData) {
    throw agentRunErrorFromResponse(response);
  }

  return response.execution.outputData;
}

export function aiAgentXhr() {
  const request = new XMLHttpRequest();
  request.open('POST', getApiUrl('/agents/run'));
  request.setRequestHeader('Accept', 'application/json');
  request.setRequestHeader('Cache-Control', 'no-store');

  const token = getStoredToken();
  if (token) {
    request.setRequestHeader('Authorization', `Bearer ${token}`);
  }

  request.responseType = 'text';
  return request;
}

export function readAgentRunXhrResponse<T>(responseText: string): T {
  const data = JSON.parse(responseText || '{}') as AgentRunResponse<T>;

  if (!data.ok || !data.execution?.outputData) {
    throw agentRunErrorFromResponse(data);
  }

  return data.execution.outputData;
}
