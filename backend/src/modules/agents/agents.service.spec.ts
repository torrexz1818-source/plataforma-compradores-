import { AgentsService } from './agents.service';
import { UserRole } from '../users/domain/user-role.enum';

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

function createService() {
  const insertedExecutions: Record<string, unknown>[] = [];
  const agentsCollection = {
    updateOne: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue(activeAgent),
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
    insertOne: jest.fn(async (document: Record<string, unknown>) => {
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
    const { service } = createService();

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
      provider: 'openai',
      timeoutMs: 10000,
      checkedUrlHost: '127.0.0.1:8000',
      errorCode: 'AI_ENGINE_INVALID_URL',
      message: 'AI_ENGINE_URL debe ser una URL absoluta https/http accesible desde el backend.',
      traceId: 'trace-invalid-url',
    });
  });
});
