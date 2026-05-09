import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UsersService } from '../users/users.service';

type AgentRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  category: string;
  automationType: string;
  useCase: string;
  functionalities: string[];
  benefits: string[];
  inputs: string[];
  outputs: string[];
  isActive: boolean;
  accentColor: string;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
};

type AgentExecutionRecord = {
  id: string;
  agentId: string;
  userId: string;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown>;
  operationName?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costAmount?: number;
  executedAt: Date;
};

const TOKEN_PRICING = {
  inputPerMillion: Number(process.env.AI_INPUT_TOKEN_USD_PER_MILLION ?? 0.15),
  outputPerMillion: Number(process.env.AI_OUTPUT_TOKEN_USD_PER_MILLION ?? 0.6),
};

@Injectable()
export class AgentsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly usersService: UsersService,
  ) {}

  async listAgents(filters?: { category?: string; automationType?: string }) {
    const query: Record<string, unknown> = {};

    if (filters?.category?.trim()) {
      query.category = filters.category.trim();
    }

    if (filters?.automationType?.trim()) {
      query.automationType = filters.automationType.trim();
    }

    const agents = await this.agentsCollection()
      .find(query)
      .sort({ isActive: -1, createdAt: -1 })
      .toArray();

    return agents.map((agent) => this.serializeAgent(agent));
  }

  async getAgentDetail(id: string) {
    const agent = await this.findAgent(id);

    if (!agent) {
      throw new NotFoundException('Agente no encontrado');
    }

    const executions = await this.executionsCollection()
      .countDocuments({ agentId: agent.id });

    return {
      ...this.serializeAgent(agent),
      executions,
    };
  }

  async getUserExecutions(userId: string) {
    const executions = await this.executionsCollection()
      .find({ userId })
      .sort({ executedAt: -1 })
      .limit(12)
      .toArray();

    const agentIds = [...new Set(executions.map((execution) => execution.agentId))];
    const agents = await this.agentsCollection()
      .find({ id: { $in: agentIds } })
      .toArray();
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));

    return executions.map((execution) => ({
      id: execution.id,
      agentId: execution.agentId,
      userId: execution.userId,
      agentName: agentsById.get(execution.agentId)?.name ?? 'Agente IA',
      inputData: execution.inputData,
      outputData: execution.outputData,
      executedAt: execution.executedAt.toISOString(),
    }));
  }

  async listUsageForAdmin() {
    const executions = await this.executionsCollection()
      .find({})
      .sort({ executedAt: -1 })
      .limit(200)
      .toArray();

    const [agents, users] = await Promise.all([
      this.agentsCollection()
        .find({ id: { $in: [...new Set(executions.map((execution) => execution.agentId))] } })
        .toArray(),
      this.usersService.findManyByIds([...new Set(executions.map((execution) => execution.userId))]),
    ]);
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
    const usersById = new Map(users.map((user) => [user.id, user]));

    return executions.map((execution) => {
      const user = usersById.get(execution.userId);
      const agent = agentsById.get(execution.agentId);

      return {
        id: execution.id,
        userId: execution.userId,
        userName: user?.fullName ?? 'Usuario',
        userRole: user?.role ?? 'buyer',
        agentName: agent?.name ?? execution.agentId,
        operationName: execution.operationName ?? 'Ejecucion de agente',
        model: execution.model ?? 'No especificado',
        inputTokens: execution.inputTokens ?? 0,
        outputTokens: execution.outputTokens ?? 0,
        totalTokens: execution.totalTokens ?? 0,
        costAmount: execution.costAmount ?? 0,
        createdAt: execution.executedAt.toISOString(),
      };
    });
  }

  async recordExternalUsage(input: {
    agentId: string;
    userId: string;
    operationName?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    costAmount?: number;
    outputData?: Record<string, unknown>;
  }) {
    await this.usersService.requireActiveUser(input.userId);
    const tokenStats = this.normalizeTokenUsage({
      inputData: {},
      outputData: input.outputData ?? {},
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      totalTokens: input.totalTokens,
      costAmount: input.costAmount,
    });
    const execution: AgentExecutionRecord = {
      id: crypto.randomUUID(),
      agentId: input.agentId,
      userId: input.userId,
      inputData: {},
      outputData: input.outputData ?? {},
      operationName: input.operationName ?? 'Operacion externa',
      model: input.model ?? 'No especificado',
      ...tokenStats,
      executedAt: new Date(),
    };

    await this.executionsCollection().insertOne(execution);
    return { success: true, id: execution.id };
  }

  async activateAgent(agentId: string) {
    const agent = await this.findAgent(agentId);

    if (!agent) {
      throw new NotFoundException('Agente no encontrado');
    }

    if (!agent.isActive) {
      await this.agentsCollection().updateOne(
        { id: agent.id },
        {
          $set: {
            isActive: true,
            updatedAt: new Date(),
          },
        },
      );
    }

    return {
      agent: {
        ...this.serializeAgent({
          ...agent,
          isActive: true,
        }),
      },
      message: 'Agente activado correctamente',
    };
  }

  async runAgent(input: {
    agentId: string;
    userId: string;
    inputData: Record<string, unknown>;
  }) {
    const [agent, user] = await Promise.all([
      this.findAgent(input.agentId),
      this.usersService.requireActiveUser(input.userId),
    ]);

    if (!agent) {
      throw new NotFoundException('Agente no encontrado');
    }

    const outputData = this.buildAgentOutput(agent, input.inputData, user.fullName);
    const tokenStats = this.normalizeTokenUsage({ inputData: input.inputData, outputData });
    const execution: AgentExecutionRecord = {
      id: crypto.randomUUID(),
      agentId: agent.id,
      userId: input.userId,
      inputData: input.inputData,
      outputData,
      operationName: 'Ejecucion de agente',
      model: 'mock-local',
      ...tokenStats,
      executedAt: new Date(),
    };

    await this.executionsCollection().insertOne(execution);

    return {
      execution: {
        id: execution.id,
        agentId: execution.agentId,
        userId: execution.userId,
        agentName: agent.name,
        inputData: execution.inputData,
        outputData: execution.outputData,
        totalTokens: execution.totalTokens,
        costAmount: execution.costAmount,
        executedAt: execution.executedAt.toISOString(),
      },
    };
  }

  private normalizeTokenUsage(input: {
    inputData: Record<string, unknown>;
    outputData: Record<string, unknown>;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    costAmount?: number;
  }) {
    const inputTokens = Math.max(0, Math.round(input.inputTokens ?? JSON.stringify(input.inputData).length / 4));
    const outputTokens = Math.max(0, Math.round(input.outputTokens ?? JSON.stringify(input.outputData).length / 4));
    const totalTokens = Math.max(input.totalTokens ?? inputTokens + outputTokens, inputTokens + outputTokens);
    const costAmount =
      input.costAmount ??
      (inputTokens / 1_000_000) * TOKEN_PRICING.inputPerMillion +
        (outputTokens / 1_000_000) * TOKEN_PRICING.outputPerMillion;

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      costAmount: Number(costAmount.toFixed(6)),
    };
  }

  private buildAgentOutput(
    agent: AgentRecord,
    inputData: Record<string, unknown>,
    userName: string,
  ) {
    const highlightsByAgent: Record<string, string[]> = {
      'agent-quote-comparator': [
        'El proveedor con mejor balance entre costo y plazo fue priorizado.',
        'Se detectaron diferencias relevantes en condiciones comerciales.',
        'La recomendacion final incluye una opcion principal y una alterna.',
      ],
      'agent-order-generator': [
        'Se estructuro una orden lista para revision.',
        'Se marcaron campos faltantes antes de emitir.',
        'La propuesta mantiene formato consistente para compras recurrentes.',
      ],
      'agent-supplier-scout': [
        'Se calculo un score comparativo entre proveedores.',
        'El ranking considera cumplimiento, capacidad y fit comercial.',
        'Se sugiere shortlist para siguiente etapa de validacion.',
      ],
      'agent-demand-forecast': [
        'Se estimo la demanda proyectada para el siguiente periodo.',
        'El escenario base sugiere una compra preventiva moderada.',
        'Se resaltaron variaciones que impactan el plan de abastecimiento.',
      ],
      'agent-risk-watch': [
        'Se detectaron alertas tempranas de continuidad y dependencia.',
        'Los riesgos se priorizaron por impacto y urgencia.',
        'Se propusieron acciones inmediatas de mitigacion.',
      ],
      'agent-negotiation-brief': [
        'Se preparo un brief ejecutivo para la negociacion.',
        'Se identificaron palancas clave y posibles concesiones.',
        'La recomendacion incluye narrativa sugerida para la reunion.',
      ],
    };

    return {
      summary: `${agent.name} genero una respuesta accionable para ${userName}.`,
      status: 'completed',
      recommendedAction: `Revisar el output y avanzar con el caso de uso: ${agent.useCase}`,
      highlights: highlightsByAgent[agent.id] ?? [
        'Se proceso la solicitud exitosamente.',
        'El agente entrego un resumen accionable.',
      ],
      receivedInputs: inputData,
      expectedOutputs: agent.outputs,
      generatedAt: new Date().toISOString(),
    };
  }

  private serializeAgent(agent: AgentRecord) {
    return {
      id: agent.id,
      slug: agent.slug,
      name: agent.name,
      description: agent.description,
      longDescription: agent.longDescription,
      category: agent.category,
      automationType: agent.automationType,
      useCase: agent.useCase,
      functionalities: agent.functionalities,
      benefits: agent.benefits,
      inputs: agent.inputs,
      outputs: agent.outputs,
      isActive: agent.isActive,
      accentColor: agent.accentColor,
      icon: agent.icon,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
    };
  }

  private findAgent(idOrSlug: string) {
    return this.agentsCollection().findOne({
      $or: [{ id: idOrSlug }, { slug: idOrSlug }],
    });
  }

  private agentsCollection() {
    return this.databaseService.collection<AgentRecord>('agents');
  }

  private executionsCollection() {
    return this.databaseService.collection<AgentExecutionRecord>('agentExecutions');
  }
}
