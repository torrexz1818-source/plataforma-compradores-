import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentRunError, classifyAgentRunError, readAgentRunXhrResponse, runAiAgent } from './agentRunApi';
import { apiRequest } from './api';
import { moduleActivationQueryPolicy } from './moduleActivation';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('agent run error handling', () => {
  it('classifies insufficient TCO data without treating it as a generic file error', () => {
    expect(classifyAgentRunError({
      errorCode: 'INSUFFICIENT_DATA',
      message: 'Faltan costos y alternativas comparables para TCO',
    })).toBe('insufficient_data');
  });

  it('preserves backend status and trace id when /agents/run fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      message: 'AI service failed',
      traceId: 'trace-500',
      errorCode: 'SERVER_ERROR',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(runAiAgent(new FormData())).rejects.toMatchObject({
      type: 'backend_error',
      status: 500,
      traceId: 'trace-500',
    });
  });

  it('reports AI engine errors when the run response has no output data', () => {
    expect(() => readAgentRunXhrResponse(JSON.stringify({
      ok: false,
      message: 'El motor de analisis no respondio',
      traceId: 'trace-ai',
    }))).toThrow(AgentRunError);

    try {
      readAgentRunXhrResponse(JSON.stringify({
        ok: false,
        message: 'El motor de analisis no respondio',
        traceId: 'trace-ai',
      }));
    } catch (error) {
      expect(error).toMatchObject({ type: 'ai_engine_error', traceId: 'trace-ai' });
    }
  });

  it('does not treat a 204 preflight-like module activation response as a request failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiRequest('/agents/module-activations/mine', { method: 'OPTIONS' })).resolves.toBeUndefined();
  });

  it('keeps module activation lookups cached instead of polling on every render', () => {
    expect(moduleActivationQueryPolicy.refetchInterval).toBe(false);
    expect(moduleActivationQueryPolicy.refetchOnMount).toBe(false);
    expect(moduleActivationQueryPolicy.refetchOnWindowFocus).toBe(false);
    expect(moduleActivationQueryPolicy.staleTime).toBeGreaterThan(0);
  });
});
