import { apiRequest, getApiUrl, getStoredToken } from '@/lib/api';

const AI_ENGINE_UNAVAILABLE_MESSAGE =
  'No se pudo conectar con el motor de IA. Intenta nuevamente en unos minutos.';

type AgentRunResponse<T> = {
  ok?: boolean;
  errorCode?: string | null;
  message?: string;
  traceId?: string;
  execution: {
    outputData?: T;
  } | null;
};

export async function runAiAgent<T>(formData: FormData): Promise<T> {
  const response = await apiRequest<AgentRunResponse<T>>('/agents/run', {
    method: 'POST',
    auth: true,
    cache: 'no-store',
    body: formData,
  });

  if (!response?.ok || !response.execution?.outputData) {
    throw new Error(response?.message || AI_ENGINE_UNAVAILABLE_MESSAGE);
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
    throw new Error(data.message || AI_ENGINE_UNAVAILABLE_MESSAGE);
  }

  return data.execution.outputData;
}
