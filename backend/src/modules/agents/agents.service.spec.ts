import { AgentsService } from './agents.service';
import { UserRole } from '../users/domain/user-role.enum';
import { readFileSync } from 'fs';
import { join } from 'path';

const activeAgent = {
  id: 'agent-terms-reference',
  agentKey: 'terms_of_reference',
  slug: 'elaboracion-terminos-referencia',
  name: 'Elaboracion de terminos de referencia',
  description: 'Genera terminos de referencia.',
  longDescription: 'Genera terminos de referencia.',
  category: 'Compras',
  automationType: 'Documento',
  useCase: 'TDR',
  functionalities: [],
  benefits: [],
  inputs: [],
  outputs: [],
  status: 'active',
  visibleToBuyer: true,
  sortOrder: 1,
  isActive: true,
  accentColor: '#000000',
  icon: 'file-text',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createService(options?: {
  agentsUpdateOne?: jest.Mock;
  agentsFindOne?: jest.Mock;
  executionsInsertOne?: jest.Mock;
}) {
  const insertedExecutions: Record<string, unknown>[] = [];
  const agentsCollection = {
    updateOne: options?.agentsUpdateOne ?? jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({}),
    findOne: options?.agentsFindOne ?? jest.fn().mockResolvedValue(activeAgent),
    find: jest.fn(() => ({
      sort: jest.fn(() => ({
        toArray: jest.fn().mockResolvedValue([activeAgent]),
      })),
    })),
  };
  const statusCollection = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn(() => ({
      toArray: jest.fn().mockResolvedValue([]),
    })),
  };
  const executionsCollection = {
    insertOne: options?.executionsInsertOne ?? jest.fn(async (document: Record<string, unknown>) => {
      insertedExecutions.push(document);
      return {};
    }),
    countDocuments: jest.fn().mockResolvedValue(0),
    find: jest.fn(() => ({
      sort: jest.fn(() => ({
        limit: jest.fn(() => ({
          toArray: jest.fn().mockResolvedValue([]),
        })),
      })),
    })),
  };
  const emptyCollection = {
    findOne: jest.fn().mockResolvedValue(null),
    insertOne: jest.fn().mockResolvedValue({}),
    updateOne: jest.fn().mockResolvedValue({}),
    find: jest.fn(() => ({
      sort: jest.fn(() => ({
        limit: jest.fn(() => ({
          toArray: jest.fn().mockResolvedValue([]),
        })),
        toArray: jest.fn().mockResolvedValue([]),
      })),
      toArray: jest.fn().mockResolvedValue([]),
    })),
  };

  const databaseService = {
    collection: jest.fn((name: string) => {
      if (name === 'agents') return agentsCollection;
      if (name === 'agentStatusSettings') return statusCollection;
      if (name === 'agentExecutions') return executionsCollection;
      return emptyCollection;
    }),
  };
  const usersService = {
    requireActiveUser: jest.fn().mockResolvedValue({
      id: 'user-buyer-1',
      fullName: 'Comprador Test',
      role: UserRole.BUYER,
    }),
    findManyByIds: jest.fn().mockResolvedValue([]),
  };

  return {
    service: new AgentsService(databaseService as never, usersService as never),
    agentsCollection,
    insertedExecutions,
  };
}

describe('AgentsService AI engine proxy', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns a stable failure when AI_ENGINE_URL is missing', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    delete process.env.AI_ENGINE_URL;
    delete process.env.BUYER_NODUS_AI_ENGINE_URL;
    const { service } = createService();

    const response = await service.runAgent({
      agentId: 'terms_of_reference',
      userId: 'user-buyer-1',
      inputData: {},
      aiOperation: 'form_schema',
      formFields: { initial_description: 'Compra de laptops' },
      requestMeta: { traceId: 'trace-missing-url', country: 'CN' },
    });

    expect(response.ok).toBe(false);
    expect(response.errorCode).toBe('AI_ENGINE_NOT_CONFIGURED');
    expect(response.execution).not.toBeUndefined();
    expect(response.execution.outputData).toMatchObject({
      ok: false,
      errorCode: 'AI_ENGINE_NOT_CONFIGURED',
      traceId: 'trace-missing-url',
    });
  });

  it('returns a stable timeout failure when AI Engine times out', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.AI_ENGINE_URL = 'https://ai.example.test';
    global.fetch = jest.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const { service, insertedExecutions } = createService();

    const response = await service.runAgent({
      agentId: 'terms_of_reference',
      userId: 'user-buyer-1',
      inputData: {},
      aiOperation: 'form_schema',
      formFields: { initial_description: 'Compra de laptops' },
      requestMeta: { traceId: 'trace-timeout', country: 'CN' },
    });

    expect(response.ok).toBe(false);
    expect(response.errorCode).toBe('AI_ENGINE_TIMEOUT');
    expect(response.execution).not.toBeUndefined();
    expect(response.execution.outputData).toMatchObject({
      ok: false,
      errorCode: 'AI_ENGINE_TIMEOUT',
      traceId: 'trace-timeout',
    });
    expect(response.execution.billable).toBe(false);
    expect(response.execution.billingStatus).toBe('non_billable_failure');
    expect(response.execution.costAmount).toBe(0);
    expect(insertedExecutions[0]).toMatchObject({
      status: 'failed',
      billable: false,
      billingStatus: 'non_billable_failure',
      costAmount: 0,
    });
  });

  it('passes trace id to the AI Engine TCO endpoint', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.AI_ENGINE_URL = 'https://ai.example.test';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        analysis_title: 'Analisis TCO',
        model_name: 'test-model',
      })),
    } as unknown as Response);
    const { service, insertedExecutions } = createService({
      agentsFindOne: jest.fn().mockResolvedValue({
        ...activeAgent,
        id: 'tco_analysis',
        agentKey: 'tco_analysis',
        slug: 'analisis-tco',
        name: 'Analisis TCO',
      }),
    });

    await service.runAgent({
      agentId: 'tco_analysis',
      userId: 'user-buyer-1',
      inputData: {},
      aiOperation: 'analyze',
      formFields: {
        agentId: 'tco_analysis',
        operation: 'analyze',
        title: 'Analisis TCO',
        item_name: 'Equipo',
        analysis_type: 'Compra',
        evaluation_horizon: '3 anos',
        currency: 'USD',
      },
      files: [],
      requestMeta: { traceId: 'trace-tco-header', country: 'CN' },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://ai.example.test/agents/tco-analysis/analyze',
      expect.objectContaining({
        method: 'POST',
        headers: { 'X-Trace-Id': 'trace-tco-header' },
      }),
    );
  });

  it('returns a structured TCO blocked payload without converting it to an engine error', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.AI_ENGINE_URL = 'https://ai.example.test';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        analysis_title: 'Analisis TCO',
        downloadReadiness: {
          status: 'blocked',
          reason: 'El modelo TCO no respondio dentro del tiempo operativo.',
        },
        model_timed_out: true,
        ranking: [],
        scorecard: null,
        financial_model: [],
        model_name: 'test-model',
      })),
    } as unknown as Response);
    const { service, insertedExecutions } = createService({
      agentsFindOne: jest.fn().mockResolvedValue({
        ...activeAgent,
        id: 'tco_analysis',
        agentKey: 'tco_analysis',
        slug: 'analisis-tco',
        name: 'Analisis TCO',
      }),
    });

    const response = await service.runAgent({
      agentId: 'tco_analysis',
      userId: 'user-buyer-1',
      inputData: {},
      aiOperation: 'analyze',
      formFields: {
        agentId: 'tco_analysis',
        operation: 'analyze',
        title: 'Analisis TCO',
        item_name: 'Equipo',
        analysis_type: 'Compra',
        evaluation_horizon: '3 anos',
        currency: 'USD',
      },
      files: [],
      requestMeta: { traceId: 'trace-tco-blocked-payload', country: 'CN' },
    });

    expect(response.ok).toBe(true);
    expect(response.errorCode).toBeNull();
    expect(response.execution.outputData).toMatchObject({
      downloadReadiness: { status: 'blocked' },
      model_timed_out: true,
      ranking: [],
      scorecard: null,
      financial_model: [],
    });
    expect(response.execution.billable).toBe(false);
    expect(response.execution.billingStatus).toBe('diagnostic');
    expect(response.execution.costAmount).toBe(0);
    expect(insertedExecutions[0]).toMatchObject({
      status: 'failed',
      billable: false,
      billingStatus: 'diagnostic',
      costAmount: 0,
    });
  });

  it('stores insufficient TCO data as blocked before model and non billable', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.AI_ENGINE_URL = 'https://ai.example.test';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        analysis_title: 'Analisis TCO',
        ok: true,
        modelCalled: false,
        billable: false,
        billingStatus: 'blocked_before_model',
        downloadReadiness: { status: 'blocked', reason: 'INSUFFICIENT_TCO_DATA' },
        ranking: [],
        scorecard: null,
        financial_model: [],
        model_name: 'preflight',
      })),
    } as unknown as Response);
    const { service, insertedExecutions } = createService({
      agentsFindOne: jest.fn().mockResolvedValue({
        ...activeAgent,
        id: 'tco_analysis',
        agentKey: 'tco_analysis',
        slug: 'analisis-tco',
        name: 'Analisis TCO',
      }),
    });

    const response = await service.runAgent({
      agentId: 'tco_analysis',
      userId: 'user-buyer-1',
      inputData: {},
      aiOperation: 'analyze',
      formFields: {
        agentId: 'tco_analysis',
        operation: 'analyze',
        title: 'Analisis TCO',
        item_name: 'Equipo',
        analysis_type: 'Compra',
        evaluation_horizon: '3 anos',
        currency: 'USD',
      },
      files: [],
      requestMeta: { traceId: 'trace-tco-insufficient', country: 'CN' },
    });

    expect(response.ok).toBe(true);
    expect(response.execution.outputData).toMatchObject({
      modelCalled: false,
      downloadReadiness: { status: 'blocked', reason: 'INSUFFICIENT_TCO_DATA' },
    });
    expect(response.execution.billable).toBe(false);
    expect(response.execution.billingStatus).toBe('blocked_before_model');
    expect(response.execution.costAmount).toBe(0);
    expect(insertedExecutions[0]).toMatchObject({
      status: 'failed',
      billable: false,
      billingStatus: 'blocked_before_model',
      inputTokens: 0,
      outputTokens: 0,
      costAmount: 0,
    });
  });

  it('marks successful AI Engine results as billable', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.AI_ENGINE_URL = 'https://ai.example.test';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        analysis_title: 'Analisis TCO',
        downloadReadiness: { status: 'ready' },
        executive_summary: { best_alternative: 'Proveedor A' },
        model_name: 'test-model',
      })),
    } as unknown as Response);
    const { service, insertedExecutions } = createService({
      agentsFindOne: jest.fn().mockResolvedValue({
        ...activeAgent,
        id: 'tco_analysis',
        agentKey: 'tco_analysis',
        slug: 'analisis-tco',
        name: 'Analisis TCO',
      }),
    });

    const response = await service.runAgent({
      agentId: 'tco_analysis',
      userId: 'user-buyer-1',
      inputData: {},
      aiOperation: 'analyze',
      formFields: {
        agentId: 'tco_analysis',
        operation: 'analyze',
        title: 'Analisis TCO',
        item_name: 'Equipo',
        analysis_type: 'Compra',
        evaluation_horizon: '3 anos',
        currency: 'USD',
      },
      files: [],
      requestMeta: { traceId: 'trace-tco-billable', country: 'CN' },
    });

    expect(response.ok).toBe(true);
    expect(response.execution.billable).toBe(true);
    expect(response.execution.billingStatus).toBe('billable');
    expect(response.execution.costAmount).toBeGreaterThan(0);
    expect(insertedExecutions[0]).toMatchObject({
      status: 'completed',
      billable: true,
      billingStatus: 'billable',
    });
  });

  it('preserves AI Engine error codes returned by the TCO endpoint', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.AI_ENGINE_URL = 'https://ai.example.test';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 504,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        detail: {
          errorCode: 'AI_ENGINE_TCO_TIMEOUT',
          message: 'El modelo TCO no respondio dentro del tiempo operativo.',
        },
      })),
    } as unknown as Response);
    const { service } = createService({
      agentsFindOne: jest.fn().mockResolvedValue({
        ...activeAgent,
        id: 'tco_analysis',
        agentKey: 'tco_analysis',
        slug: 'analisis-tco',
        name: 'Analisis TCO',
      }),
    });

    const response = await service.runAgent({
      agentId: 'tco_analysis',
      userId: 'user-buyer-1',
      inputData: {},
      aiOperation: 'analyze',
      formFields: {
        agentId: 'tco_analysis',
        operation: 'analyze',
        title: 'Analisis TCO',
        item_name: 'Equipo',
        analysis_type: 'Compra',
        evaluation_horizon: '3 anos',
        currency: 'USD',
      },
      files: [],
      requestMeta: { traceId: 'trace-tco-timeout', country: 'CN' },
    });

    expect(response.ok).toBe(false);
    expect(response.errorCode).toBe('AI_ENGINE_TCO_TIMEOUT');
    expect(response.traceId).toBe('trace-tco-timeout');
    expect(response.execution.outputData).toMatchObject({
      ok: false,
      errorCode: 'AI_ENGINE_TCO_TIMEOUT',
      traceId: 'trace-tco-timeout',
    });
  });

  it('never returns execution as undefined on provider mock errors', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.AI_ENGINE_URL = 'https://ai.example.test';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: jest.fn().mockResolvedValue(JSON.stringify({ detail: 'provider unavailable' })),
    } as unknown as Response);
    const { service } = createService();

    const response = await service.runAgent({
      agentId: 'terms_of_reference',
      userId: 'user-buyer-1',
      inputData: {},
      aiOperation: 'form_schema',
      formFields: { initial_description: 'Compra de laptops' },
      requestMeta: { traceId: 'trace-provider-error', country: 'CN' },
    });

    expect(response.ok).toBe(false);
    expect(response.errorCode).toBe('AI_PROVIDER_ERROR');
    expect(response.execution).not.toBeUndefined();
    expect(response.execution).toBeTruthy();
  });

  it('returns stable health JSON for invalid AI_ENGINE_URL values', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.AI_ENGINE_URL = 'http://127.0.0.1:8000';
    const { service } = createService();

    const response = await service.getAiHealth({ traceId: 'trace-invalid-url', country: 'CN' });

    expect(response).toEqual({
      ok: false,
      backend: 'ok',
      aiEngineConfigured: false,
      aiEngineReachable: false,
      provider: 'anthropic',
      timeoutMs: 10000,
      checkedUrlHost: '127.0.0.1:8000',
      errorCode: 'AI_ENGINE_INVALID_URL',
      message: 'AI_ENGINE_URL debe ser una URL absoluta https/http accesible desde el backend.',
      traceId: 'trace-invalid-url',
    });
  });

  it('upserts the agent catalog without duplicate Mongo update paths', async () => {
    process.env.NODE_ENV = 'production';
    const { service, agentsCollection } = createService();

    await service.listAgents({ includeHidden: true });

    expect(agentsCollection.updateOne).toHaveBeenCalled();
    for (const call of agentsCollection.updateOne.mock.calls) {
      const update = call[1] as { $set?: Record<string, unknown>; $setOnInsert?: Record<string, unknown> };
      const setKeys = Object.keys(update.$set ?? {});
      const setOnInsertKeys = Object.keys(update.$setOnInsert ?? {});
      const duplicates = setKeys.filter((key) => setOnInsertKeys.includes(key));

      expect(duplicates).toEqual([]);
      expect(update.$set?.name).toBeDefined();
      expect(update.$setOnInsert?.name).toBeUndefined();
    }
  });

  it('continues runAgent with the static catalog when catalog sync has a non-critical Mongo conflict', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.AI_ENGINE_URL = 'https://ai.example.test';
    const catalogConflict = new Error("Updating the path 'name' would create a conflict at 'name'");
    const { service } = createService({
      agentsUpdateOne: jest.fn().mockRejectedValue(catalogConflict),
      agentsFindOne: jest.fn().mockRejectedValue(catalogConflict),
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        dashboard_title: 'Dashboard de compras',
        executive_summary: 'Resumen generado con datos estructurados.',
        model_name: 'deterministic-dashboard',
      })),
    } as unknown as Response);

    const response = await service.runAgent({
      agentId: 'dashboard_creator',
      userId: 'user-buyer-1',
      inputData: {},
      aiOperation: 'generate',
      formFields: {
        agentId: 'dashboard_creator',
        operation: 'generate',
        title: 'Dashboard',
        objective: 'Analizar compras',
        use_llm_insights: 'false',
      },
      files: [],
      requestMeta: { traceId: 'trace-catalog-conflict', country: 'CN' },
    });

    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://ai.example.test/agents/dashboard-creator/generate',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(response.execution.outputData).toMatchObject({
      dashboard_title: 'Dashboard de compras',
    });
  });

  it('returns a successful agent result when execution persistence fails after an AI Engine OK response', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.AI_ENGINE_URL = 'https://ai.example.test';
    const { service } = createService({
      executionsInsertOne: jest.fn().mockRejectedValue(new Error('Mongo write unavailable')),
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        dashboard_title: 'Dashboard de compras',
        executive_summary: 'Resumen generado con datos estructurados.',
        model_name: 'deterministic-dashboard',
      })),
    } as unknown as Response);

    const response = await service.runAgent({
      agentId: 'dashboard_creator',
      userId: 'user-buyer-1',
      inputData: {},
      aiOperation: 'generate',
      formFields: {
        agentId: 'dashboard_creator',
        operation: 'generate',
        title: 'Dashboard',
        objective: 'Analizar compras',
        use_llm_insights: 'false',
      },
      files: [],
      requestMeta: { traceId: 'trace-persist-failed', country: 'CN' },
    });

    expect(response.ok).toBe(true);
    expect(response.execution.outputData).toMatchObject({
      dashboard_title: 'Dashboard de compras',
    });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('AGENT_EXECUTION_PERSIST_FAILED'));
  });

  it('sanitizes sensitive values from AI run logs', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { service } = createService();
    const unsafeToken = ['Bearer', 'secret-token-123'].join(' ');

    (
      service as unknown as {
        logAiEvent: (event: Record<string, unknown>) => void;
      }
    ).logAiEvent({
      endpoint: '/agents/run',
      traceId: 'trace-safe-log',
      provider: 'anthropic',
      stage: 'ai_engine_response',
      statusCode: 503,
      message: `Request failed with ${unsafeToken}`,
    });

    const logged = String(errorSpy.mock.calls[0]?.[0] ?? '');
    expect(logged).not.toContain(unsafeToken);
    expect(logged).toContain('Bearer [redacted]');
  });

  it('does not reference the removed legacy provider in the backend agent runtime', () => {
    const source = readFileSync(join(__dirname, 'agents.service.ts'), 'utf8').toLowerCase();
    const removedProvider = ['o', 'p', 'e', 'n', 'a', 'i'].join('');
    const removedKey = ['open', 'ai', '_api_key'].join('');

    expect(source).not.toContain(removedProvider);
    expect(source).not.toContain(removedKey);
  });
});
