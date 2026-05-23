import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/domain/user-role.enum';

export type AgentStatus = 'active' | 'coming_soon' | 'disabled' | 'hidden';
type FeedbackAdminStatus =
  | 'pending'
  | 'reviewed'
  | 'dismissed'
  | 'converted_to_rule'
  | 'needs_prompt_update'
  | 'needs_template_update'
  | 'needs_validation_update';

type AgentRecord = {
  id: string;
  agentKey: string;
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
  status: AgentStatus;
  visibleToBuyer: boolean;
  sortOrder: number;
  isActive: boolean;
  accentColor: string;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
};

type AgentExecutionRecord = {
  id: string;
  agentRunId: string;
  agentId: string;
  agentKey: string;
  agentName: string;
  userId: string;
  userRole: string;
  inputData: Record<string, unknown>;
  inputSummary?: string;
  inputPayloadJson?: Record<string, unknown>;
  outputData: Record<string, unknown>;
  outputJson?: Record<string, unknown>;
  outputText?: string;
  status: 'completed' | 'failed';
  errorMessage?: string;
  operationName?: string;
  modelProvider?: string;
  modelName?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  costInput?: number;
  costOutput?: number;
  costTotal?: number;
  costAmount?: number;
  latencyMs?: number;
  fileCount?: number;
  fileTypesJson?: string[];
  approxTotalFileSize?: number;
  pdfGenerated?: boolean;
  executedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type AgentFeedbackRecord = {
  id: string;
  agentRunId: string;
  userId: string;
  agentKey: string;
  stars: number;
  rating: 'positive' | 'negative' | 'suggestion';
  feedbackType: string;
  errorCategoriesJson: string[];
  comment?: string;
  correctedVersion?: string;
  improvementSuggestion?: string;
  adminStatus: FeedbackAdminStatus;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
};

const TOKEN_PRICING = {
  inputPerMillion: Number(process.env.AI_INPUT_TOKEN_USD_PER_MILLION ?? 0.15),
  outputPerMillion: Number(process.env.AI_OUTPUT_TOKEN_USD_PER_MILLION ?? 0.6),
};

const AGENT_CATALOG: Array<Omit<AgentRecord, 'createdAt' | 'updatedAt'>> = [
  {
    id: 'terms_of_reference',
    agentKey: 'terms_of_reference',
    slug: 'elaboracion-terminos-referencia',
    name: 'Elaboracion de terminos de referencia',
    description: 'Redacta terminos de referencia claros y bien estructurados para procesos de compra y contratacion.',
    longDescription: 'Ayuda a construir TdR a partir del objetivo, alcance y entregables de la necesidad, entregando una base consistente para solicitar propuestas y alinear expectativas.',
    category: 'Compras',
    automationType: 'Generacion',
    useCase: 'Preparar bases documentales para servicios, consultorias, licitaciones y compras tecnicas.',
    functionalities: ['Estructura objetivo, alcance y entregables', 'Propone secciones minimas requeridas', 'Genera borrador listo para revision'],
    benefits: ['Reduce tiempo de redaccion', 'Mejora consistencia documental', 'Facilita coordinacion con usuarios internos'],
    inputs: ['Objetivo de la contratacion', 'Alcance', 'Entregables esperados', 'Documentos de apoyo'],
    outputs: ['Borrador de TdR', 'Criterios sugeridos', 'Estructura documental', 'PDF descargable'],
    status: 'active',
    visibleToBuyer: true,
    sortOrder: 1,
    isActive: true,
    accentColor: '#2563eb',
    icon: 'FileCheck',
  },
  {
    id: 'proposal_comparison',
    agentKey: 'proposal_comparison',
    slug: 'comparativos-propuestas-proveedores',
    name: 'Comparativos de propuestas de proveedores',
    description: 'Sube propuestas de proveedores y recibe una tabla comparativa con condiciones, riesgos, ranking y recomendacion final.',
    longDescription: 'Centraliza propuestas comerciales, analiza diferencias clave y genera un comparativo orientado a decision para procesos RFQ, licitaciones privadas y compras recurrentes.',
    category: 'Compras',
    automationType: 'Evaluacion',
    useCase: 'Comparar propuestas en procesos de compra y sustentar la recomendacion de adjudicacion.',
    functionalities: ['Consolida propuestas y anexos', 'Ordena diferencias por precio, plazo y condiciones', 'Genera comparativo ejecutivo listo para compartir'],
    benefits: ['Acelera decisiones de compra', 'Reduce sesgos al evaluar propuestas', 'Mejora trazabilidad para auditoria interna'],
    inputs: ['Archivos de propuestas', 'Servicio o categoria', 'Objetivo del analisis'],
    outputs: ['Tabla comparativa', 'Ranking recomendado', 'Resumen ejecutivo', 'Recomendacion final', 'PDF descargable'],
    status: 'active',
    visibleToBuyer: true,
    sortOrder: 2,
    isActive: true,
    accentColor: '#0f766e',
    icon: 'Scale',
  },
  {
    id: 'tco_analysis',
    agentKey: 'tco_analysis',
    slug: 'analisis-costo-total-tco',
    name: 'Analisis de Costo Total / TCO',
    description: 'Calcula el costo total real de una compra considerando precio inicial, instalacion, transporte, mantenimiento, operacion, garantia, soporte, repuestos, riesgos y costos ocultos.',
    longDescription: 'Compara alternativas por proveedor con una mirada de costo total para evitar decisiones basadas solo en precio inicial.',
    category: 'Finanzas',
    automationType: 'Analitica',
    useCase: 'Evaluar compras con impacto de largo plazo y sustentar una recomendacion TCO.',
    functionalities: ['Calcula costo inicial vs costo total proyectado', 'Detecta costos ocultos y supuestos criticos', 'Compara alternativas por proveedor', 'Genera recomendacion basada en TCO'],
    benefits: ['Evita elegir solo por precio inicial', 'Mejora decisiones de compra a largo plazo', 'Ayuda a justificar la recomendacion ante gerencia'],
    inputs: ['Alternativas por proveedor', 'Costos iniciales', 'Costos operativos', 'Horizonte de evaluacion'],
    outputs: ['Tabla TCO por proveedor', 'Costo total proyectado', 'Riesgos financieros', 'Recomendacion final', 'PDF descargable'],
    status: 'coming_soon',
    visibleToBuyer: true,
    sortOrder: 3,
    isActive: false,
    accentColor: '#0369a1',
    icon: 'TrendingUp',
  },
  {
    id: 'purchase_order',
    agentKey: 'purchase_order',
    slug: 'elaboracion-orden-compra',
    name: 'Elaboracion de Orden de Compra',
    description: 'Genera una orden de compra formal a partir del proveedor seleccionado, condiciones comerciales, items, cantidades, precios, impuestos, entrega y observaciones.',
    longDescription: 'Estructura una orden lista para revision administrativa, con totales y condiciones comerciales ordenadas.',
    category: 'Compras',
    automationType: 'Generacion',
    useCase: 'Formalizar una compra aprobada con una orden estructurada y descargable.',
    functionalities: ['Estructura datos de proveedor y comprador', 'Genera tabla de items', 'Calcula subtotal, impuestos y total', 'Ordena condiciones comerciales'],
    benefits: ['Reduce errores administrativos', 'Estandariza ordenes de compra', 'Acelera la formalizacion de la compra'],
    inputs: ['Proveedor seleccionado', 'Items', 'Cantidades', 'Precios', 'Impuestos', 'Entrega'],
    outputs: ['Orden de compra estructurada', 'Tabla de items', 'Totales', 'Condiciones de pago y entrega', 'PDF descargable'],
    status: 'coming_soon',
    visibleToBuyer: true,
    sortOrder: 4,
    isActive: false,
    accentColor: '#0f766e',
    icon: 'FileCheck',
  },
  {
    id: 'dashboard_creator',
    agentKey: 'dashboard_creator',
    slug: 'creador-dashboard',
    name: 'Creador de Dashboard',
    description: 'Crea un dashboard visual a partir de datos de compras, gastos, proveedores o indicadores cargados por el comprador, identificando KPIs, graficos, tablas e insights relevantes.',
    longDescription: 'Convierte datos subidos por el comprador en una estructura de dashboard con KPIs, tablas, graficos simples, insights y recomendaciones.',
    category: 'Reporteria',
    automationType: 'Analitica',
    useCase: 'Crear una vista ejecutiva inicial a partir de datos de compras o proveedores.',
    functionalities: ['Lee archivos de datos', 'Propone KPIs', 'Genera estructura de dashboard', 'Crea tablas y graficos visuales en la plataforma', 'Detecta insights relevantes'],
    benefits: ['Convierte datos en visualizaciones utiles', 'Ayuda a presentar resultados a gerencia', 'Reduce trabajo manual en Excel o Power BI inicial'],
    inputs: ['Archivo de datos', 'Objetivo del dashboard', 'Audiencia', 'Periodo'],
    outputs: ['Dashboard visual generado', 'KPIs principales', 'Graficos', 'Tablas', 'Insights', 'Recomendaciones', 'PDF descargable'],
    status: 'coming_soon',
    visibleToBuyer: true,
    sortOrder: 5,
    isActive: false,
    accentColor: '#7c3aed',
    icon: 'BrainCircuit',
  },
  {
    id: 'spend_analysis',
    agentKey: 'spend_analysis',
    slug: 'analisis-gastos',
    name: 'Analisis de Gastos',
    description: 'Analiza gastos por proveedor, categoria, centro de costo, periodo o area para detectar concentracion, variaciones, oportunidades de ahorro y riesgos.',
    longDescription: 'Agrupa datos de gasto y prioriza oportunidades de ahorro, proveedores criticos y variaciones relevantes.',
    category: 'Finanzas',
    automationType: 'Analitica',
    useCase: 'Explorar gasto por proveedor, categoria o periodo para priorizar negociaciones.',
    functionalities: ['Lee Excel/CSV de gastos', 'Agrupa por proveedor, categoria y periodo', 'Detecta top gastos', 'Detecta variaciones', 'Sugiere oportunidades de ahorro'],
    benefits: ['Mejora control del gasto', 'Identifica proveedores criticos', 'Ayuda a priorizar negociaciones'],
    inputs: ['Archivo Excel/CSV de gastos', 'Periodo', 'Categoria', 'Centro de costo'],
    outputs: ['Resumen de gastos', 'Top proveedores', 'Top categorias', 'Variaciones', 'Alertas', 'Recomendaciones', 'PDF descargable'],
    status: 'coming_soon',
    visibleToBuyer: true,
    sortOrder: 6,
    isActive: false,
    accentColor: '#be185d',
    icon: 'TrendingUp',
  },
  {
    id: 'contract_risk_analysis',
    agentKey: 'contract_risk_analysis',
    slug: 'analisis-contratos-riesgos',
    name: 'Analisis de Contratos y Deteccion de Riesgos',
    description: 'Analiza contratos de proveedores para detectar clausulas criticas, riesgos, obligaciones, penalidades, vencimientos, renovaciones y puntos de negociacion.',
    longDescription: 'Resume obligaciones contractuales y prioriza alertas para que compras pueda revisar riesgos antes de firmar o renovar.',
    category: 'Contratos',
    automationType: 'Riesgo',
    useCase: 'Revisar contratos de proveedores y levantar puntos criticos de negociacion.',
    functionalities: ['Lee contratos PDF/DOCX', 'Resume obligaciones', 'Detecta riesgos', 'Identifica clausulas criticas', 'Detecta penalidades y vencimientos'],
    benefits: ['Reduce riesgo contractual', 'Mejora revision previa a firma', 'Ayuda a compradores no legales a detectar alertas'],
    inputs: ['Contrato o anexos', 'Contexto de compra', 'Puntos de preocupacion'],
    outputs: ['Resumen contractual', 'Matriz de riesgos', 'Clausulas criticas', 'Obligaciones', 'Recomendaciones', 'PDF descargable'],
    status: 'coming_soon',
    visibleToBuyer: true,
    sortOrder: 7,
    isActive: false,
    accentColor: '#dc2626',
    icon: 'TriangleAlert',
  },
  {
    id: 'supplier_evaluation_ranking',
    agentKey: 'supplier_evaluation_ranking',
    slug: 'evaluacion-ranking-proveedores',
    name: 'Evaluacion y Ranking de Proveedores',
    description: 'Evalua proveedores segun criterios tecnicos, comerciales, cumplimiento, experiencia, documentacion, desempeno y riesgo para generar ranking y recomendacion.',
    longDescription: 'Estandariza la evaluacion de proveedores con criterios, pesos, score, riesgos y documentacion faltante.',
    category: 'Proveedores',
    automationType: 'Evaluacion',
    useCase: 'Seleccionar proveedores con un ranking sustentado y comparable.',
    functionalities: ['Evalua informacion de proveedores', 'Genera criterios y pesos', 'Califica proveedores', 'Detecta documentacion faltante', 'Genera ranking'],
    benefits: ['Mejora seleccion de proveedores', 'Reduce decisiones subjetivas', 'Estandariza evaluacion'],
    inputs: ['Informacion de proveedores', 'Criterios de evaluacion', 'Pesos', 'Documentacion'],
    outputs: ['Score por proveedor', 'Ranking', 'Fortalezas', 'Riesgos', 'Documentacion faltante', 'Recomendacion', 'PDF descargable'],
    status: 'coming_soon',
    visibleToBuyer: true,
    sortOrder: 8,
    isActive: false,
    accentColor: '#64748b',
    icon: 'ShieldCheck',
  },
];

@Injectable()
export class AgentsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly usersService: UsersService,
  ) {}

  async listAgents(filters?: { category?: string; automationType?: string; includeHidden?: boolean }) {
    await this.ensureAgentCatalog();
    const query: Record<string, unknown> = {};

    if (!filters?.includeHidden) {
      query.visibleToBuyer = true;
      query.status = { $ne: 'hidden' };
    }
    if (filters?.category?.trim()) query.category = filters.category.trim();
    if (filters?.automationType?.trim()) query.automationType = filters.automationType.trim();

    const agents = await this.agentsCollection().find(query).sort({ sortOrder: 1, name: 1 }).toArray();
    return agents.map((agent) => this.serializeAgent(agent));
  }

  async getAgentDetail(id: string, options?: { includeHidden?: boolean }) {
    await this.ensureAgentCatalog();
    const agent = await this.findAgent(id);

    if (!agent || (!options?.includeHidden && agent.status === 'hidden')) {
      throw new NotFoundException('Agente no encontrado');
    }

    const executions = await this.executionsCollection().countDocuments({ agentKey: agent.agentKey });
    const feedbackSummary = await this.getFeedbackSummary(agent.agentKey);
    return { ...this.serializeAgent(agent), executions, ...feedbackSummary };
  }

  async getUserExecutions(userId: string) {
    const executions = await this.executionsCollection()
      .find({ userId })
      .sort({ executedAt: -1 })
      .limit(12)
      .toArray();

    return executions.map((execution) => ({
      id: execution.id,
      agentRunId: execution.agentRunId,
      agentId: execution.agentKey || execution.agentId,
      userId: execution.userId,
      agentName: execution.agentName ?? execution.agentId,
      inputData: execution.inputData,
      outputData: execution.outputData,
      totalTokens: execution.totalTokens,
      costAmount: execution.costAmount ?? execution.costTotal,
      pdfGenerated: execution.pdfGenerated ?? false,
      executedAt: execution.executedAt.toISOString(),
    }));
  }

  async listAgentsForAdmin() {
    await this.ensureAgentCatalog();
    const [agents, runs, feedback] = await Promise.all([
      this.agentsCollection().find({}).sort({ sortOrder: 1, name: 1 }).toArray(),
      this.executionsCollection().find({}).toArray(),
      this.feedbackCollection().find({}).toArray(),
    ]);

    return agents.map((agent) => {
      const agentRuns = runs.filter((run) => (run.agentKey || run.agentId) === agent.agentKey);
      const agentFeedback = feedback.filter((item) => item.agentKey === agent.agentKey);
      return {
        ...this.serializeAgent(agent),
        metrics: this.buildMetrics(agentRuns, agentFeedback),
        recommendations: this.buildRecommendations(agent, agentRuns, agentFeedback),
      };
    });
  }

  async getAdminMetrics() {
    const agents = await this.listAgentsForAdmin();
    const runs = await this.executionsCollection().find({}).toArray();
    const feedback = await this.feedbackCollection().find({}).toArray();
    const activeAgents = agents.filter((agent) => agent.status === 'active').length;
    const comingSoonAgents = agents.filter((agent) => agent.status === 'coming_soon').length;
    const totals = this.buildMetrics(runs, feedback);
    const byAgent = agents.map((agent) => ({ agent, metrics: agent.metrics }));
    const mostUsed = byAgent.sort((a, b) => b.metrics.executions - a.metrics.executions)[0]?.agent.name ?? 'Sin datos';
    const highestCost = byAgent.sort((a, b) => b.metrics.costTotal - a.metrics.costTotal)[0]?.agent.name ?? 'Sin datos';
    const worstRated = byAgent
      .filter((item) => item.metrics.averageStars > 0)
      .sort((a, b) => a.metrics.averageStars - b.metrics.averageStars)[0]?.agent.name ?? 'Sin datos';

    return {
      activeAgents,
      comingSoonAgents,
      totalExecutions: totals.executions,
      totalTokenCost: totals.costTotal,
      tokensInputTotal: totals.tokensInput,
      tokensOutputTotal: totals.tokensOutput,
      costInputTotal: totals.costInput,
      costOutputTotal: totals.costOutput,
      averageLatencyMs: totals.averageLatencyMs,
      averageStars: totals.averageStars,
      pendingNegativeFeedback: feedback.filter((item) => item.rating === 'negative' && item.adminStatus === 'pending').length,
      mostUsedAgent: mostUsed,
      highestCostAgent: highestCost,
      worstRatedAgent: worstRated,
    };
  }

  async listUsageForAdmin() {
    const executions = await this.executionsCollection().find({}).sort({ executedAt: -1 }).limit(200).toArray();
    const users = await this.usersService.findManyByIds([...new Set(executions.map((execution) => execution.userId))]);
    const usersById = new Map(users.map((user) => [user.id, user]));

    return executions.map((execution) => {
      const user = usersById.get(execution.userId);
      return {
        id: execution.id,
        agentRunId: execution.agentRunId,
        userId: execution.userId,
        userName: user?.fullName ?? 'Usuario',
        userRole: user?.role ?? execution.userRole ?? 'buyer',
        agentKey: execution.agentKey,
        agentName: execution.agentName ?? execution.agentId,
        operationName: execution.operationName ?? 'Ejecucion de agente',
        model: execution.modelName ?? execution.model ?? 'No especificado',
        modelProvider: execution.modelProvider ?? 'openai',
        inputTokens: execution.inputTokens ?? 0,
        outputTokens: execution.outputTokens ?? 0,
        totalTokens: execution.totalTokens ?? 0,
        costInput: execution.costInput ?? 0,
        costOutput: execution.costOutput ?? 0,
        costTotal: execution.costTotal ?? execution.costAmount ?? 0,
        costAmount: execution.costAmount ?? execution.costTotal ?? 0,
        latencyMs: execution.latencyMs ?? null,
        status: execution.status ?? 'completed',
        errorMessage: execution.errorMessage,
        pdfGenerated: execution.pdfGenerated ?? false,
        outputData: execution.outputData,
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
    latencyMs?: number;
    pdfGenerated?: boolean;
  }) {
    const user = await this.usersService.requireActiveUser(input.userId);
    const agent = await this.findAgent(input.agentId);
    const agentKey = agent?.agentKey ?? this.normalizeLegacyAgentKey(input.agentId);
    const tokenStats = this.normalizeTokenUsage({
      inputData: {},
      outputData: input.outputData ?? {},
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      totalTokens: input.totalTokens,
      costAmount: input.costAmount,
    });
    const now = new Date();
    const execution: AgentExecutionRecord = {
      id: randomUUID(),
      agentRunId: randomUUID(),
      agentId: agentKey,
      agentKey,
      agentName: agent?.name ?? input.agentId,
      userId: input.userId,
      userRole: user.role,
      inputData: {},
      inputPayloadJson: {},
      outputData: input.outputData ?? {},
      outputJson: input.outputData ?? {},
      status: 'completed',
      operationName: input.operationName ?? 'Operacion externa',
      modelProvider: 'openai',
      modelName: input.model ?? 'No especificado',
      model: input.model ?? 'No especificado',
      ...tokenStats,
      latencyMs: input.latencyMs,
      pdfGenerated: input.pdfGenerated ?? false,
      executedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await this.executionsCollection().insertOne(execution);
    return { success: true, id: execution.id, agentRunId: execution.agentRunId };
  }

  async updateAgentStatus(agentKey: string, status: AgentStatus) {
    await this.ensureAgentCatalog();
    if (!['active', 'coming_soon', 'disabled', 'hidden'].includes(status)) {
      throw new BadRequestException('Estado de agente invalido');
    }
    const agent = await this.findAgent(agentKey);
    if (!agent) throw new NotFoundException('Agente no encontrado');

    await this.agentsCollection().updateOne(
      { agentKey: agent.agentKey },
      {
        $set: {
          status,
          isActive: status === 'active',
          visibleToBuyer: status !== 'hidden',
          updatedAt: new Date(),
        },
      },
    );

    return { agent: await this.getAgentDetail(agent.agentKey, { includeHidden: true }), message: 'Estado actualizado correctamente' };
  }

  async activateAgent(agentId: string) {
    return this.updateAgentStatus(agentId, 'active');
  }

  async runAgent(input: { agentId: string; userId: string; userRole?: string; inputData: Record<string, unknown> }) {
    await this.ensureAgentCatalog();
    const [agent, user] = await Promise.all([this.findAgent(input.agentId), this.usersService.requireActiveUser(input.userId)]);

    if (!agent) throw new NotFoundException('Agente no encontrado');
    if (user.role !== UserRole.BUYER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Nodus IA esta disponible para compradores');
    }
    if (agent.status !== 'active') {
      throw new ForbiddenException(agent.status === 'coming_soon' ? 'Este agente estara disponible proximamente' : 'Este agente no esta disponible');
    }

    const startedAt = Date.now();
    const outputData = this.buildAgentOutput(agent, input.inputData, user.fullName);
    const tokenStats = this.normalizeTokenUsage({ inputData: input.inputData, outputData });
    const now = new Date();
    const execution: AgentExecutionRecord = {
      id: randomUUID(),
      agentRunId: randomUUID(),
      agentId: agent.id,
      agentKey: agent.agentKey,
      agentName: agent.name,
      userId: input.userId,
      userRole: user.role,
      inputData: input.inputData,
      inputSummary: this.summarizeInput(input.inputData),
      inputPayloadJson: input.inputData,
      outputData,
      outputJson: outputData,
      outputText: String(outputData.summary ?? ''),
      status: 'completed',
      operationName: 'Ejecucion de agente',
      modelProvider: 'openai',
      modelName: 'mock-local',
      model: 'mock-local',
      ...tokenStats,
      latencyMs: Date.now() - startedAt,
      fileCount: 0,
      fileTypesJson: [],
      pdfGenerated: false,
      executedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await this.executionsCollection().insertOne(execution);
    return {
      execution: {
        id: execution.id,
        agentRunId: execution.agentRunId,
        agentId: execution.agentKey,
        userId: execution.userId,
        agentName: agent.name,
        inputData: execution.inputData,
        outputData: execution.outputData,
        totalTokens: execution.totalTokens,
        costAmount: execution.costAmount,
        pdfGenerated: execution.pdfGenerated,
        executedAt: execution.executedAt.toISOString(),
      },
    };
  }

  async submitFeedback(input: {
    agentRunId: string;
    userId: string;
    stars: number;
    feedbackType: string;
    comment?: string;
    correctedVersion?: string;
    improvementSuggestion?: string;
    errorCategories?: string[];
  }) {
    const run = await this.executionsCollection().findOne({ agentRunId: input.agentRunId });
    if (!run || run.userId !== input.userId) throw new NotFoundException('Ejecucion no encontrada');
    const stars = Math.min(5, Math.max(1, Math.round(input.stars)));
    const rating = input.feedbackType === 'tuvo_errores' || stars <= 2 ? 'negative' : input.feedbackType === 'sugerencia' ? 'suggestion' : 'positive';
    const now = new Date();
    const feedback: AgentFeedbackRecord = {
      id: randomUUID(),
      agentRunId: input.agentRunId,
      userId: input.userId,
      agentKey: run.agentKey,
      stars,
      rating,
      feedbackType: input.feedbackType,
      errorCategoriesJson: input.errorCategories ?? [],
      comment: input.comment,
      correctedVersion: input.correctedVersion,
      improvementSuggestion: input.improvementSuggestion,
      adminStatus: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    await this.feedbackCollection().insertOne(feedback);
    return { success: true, feedbackId: feedback.id };
  }

  async listFeedbackForAdmin() {
    const feedback = await this.feedbackCollection().find({}).sort({ createdAt: -1 }).limit(300).toArray();
    const users = await this.usersService.findManyByIds([...new Set(feedback.map((item) => item.userId))]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    return feedback.map((item) => ({
      id: item.id,
      agentRunId: item.agentRunId,
      userId: item.userId,
      userName: usersById.get(item.userId)?.fullName ?? 'Usuario',
      agentKey: item.agentKey,
      stars: item.stars,
      rating: item.rating,
      feedbackType: item.feedbackType,
      comment: item.comment,
      correctedVersion: item.correctedVersion,
      improvementSuggestion: item.improvementSuggestion,
      adminStatus: item.adminStatus,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  async updateFeedbackStatus(feedbackId: string, payload: { adminStatus?: FeedbackAdminStatus; adminNotes?: string }) {
    const result = await this.feedbackCollection().updateOne(
      { id: feedbackId },
      { $set: { adminStatus: payload.adminStatus ?? 'reviewed', adminNotes: payload.adminNotes, updatedAt: new Date() } },
    );
    if (!result.matchedCount) throw new NotFoundException('Feedback no encontrado');
    return { success: true };
  }

  private async ensureAgentCatalog() {
    const now = new Date();
    await Promise.all(
      AGENT_CATALOG.map((agent) =>
        this.agentsCollection().updateOne(
          { agentKey: agent.agentKey },
          {
            $setOnInsert: { ...agent, createdAt: now },
            $set: {
              name: agent.name,
              slug: agent.slug,
              description: agent.description,
              longDescription: agent.longDescription,
              category: agent.category,
              automationType: agent.automationType,
              useCase: agent.useCase,
              functionalities: agent.functionalities,
              benefits: agent.benefits,
              inputs: agent.inputs,
              outputs: agent.outputs,
              accentColor: agent.accentColor,
              icon: agent.icon,
              sortOrder: agent.sortOrder,
              updatedAt: now,
            },
          },
          { upsert: true },
        ),
      ),
    );

    await this.agentsCollection().updateMany(
      { agentKey: { $exists: false } },
      { $set: { status: 'hidden', visibleToBuyer: false, updatedAt: now } },
    );
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
    const costInput = (inputTokens / 1_000_000) * TOKEN_PRICING.inputPerMillion;
    const costOutput = (outputTokens / 1_000_000) * TOKEN_PRICING.outputPerMillion;
    const costTotal = input.costAmount ?? costInput + costOutput;

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      costInput: Number(costInput.toFixed(6)),
      costOutput: Number(costOutput.toFixed(6)),
      costTotal: Number(costTotal.toFixed(6)),
      costAmount: Number(costTotal.toFixed(6)),
    };
  }

  private buildAgentOutput(agent: AgentRecord, inputData: Record<string, unknown>, userName: string) {
    return {
      summary: `${agent.name} genero una respuesta accionable para ${userName}.`,
      status: 'completed',
      recommendedAction: agent.status === 'active' ? `Revisar el output y avanzar con el caso de uso: ${agent.useCase}` : 'Agente preparado para activacion administrativa.',
      highlights: ['Se proceso la solicitud exitosamente.', 'El resultado puede descargarse en PDF.', 'La ejecucion quedo disponible para revision admin.'],
      receivedInputs: inputData,
      expectedOutputs: agent.outputs,
      generatedAt: new Date().toISOString(),
    };
  }

  private buildMetrics(runs: AgentExecutionRecord[], feedback: AgentFeedbackRecord[]) {
    const successful = runs.filter((run) => run.status !== 'failed').length;
    const errors = runs.length - successful;
    const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);
    const stars = feedback.map((item) => item.stars).filter((value) => value > 0);
    return {
      executions: runs.length,
      successfulRuns: successful,
      failedRuns: errors,
      errors,
      tokensInput: sum(runs.map((run) => run.inputTokens ?? 0)),
      tokensOutput: sum(runs.map((run) => run.outputTokens ?? 0)),
      costInput: Number(sum(runs.map((run) => run.costInput ?? 0)).toFixed(6)),
      costOutput: Number(sum(runs.map((run) => run.costOutput ?? 0)).toFixed(6)),
      costTotal: Number(sum(runs.map((run) => run.costTotal ?? run.costAmount ?? 0)).toFixed(6)),
      averageLatencyMs: runs.length ? Math.round(sum(runs.map((run) => run.latencyMs ?? 0)) / runs.length) : 0,
      averageStars: stars.length ? Number((sum(stars) / stars.length).toFixed(2)) : 0,
      pendingFeedback: feedback.filter((item) => item.adminStatus === 'pending').length,
      negativeFeedback: feedback.filter((item) => item.rating === 'negative').length,
      pdfGenerated: runs.filter((run) => run.pdfGenerated).length,
    };
  }

  private async getFeedbackSummary(agentKey: string) {
    const feedback = await this.feedbackCollection().find({ agentKey }).toArray();
    return {
      feedbackCount: feedback.length,
      averageStars: feedback.length ? Number((feedback.reduce((acc, item) => acc + item.stars, 0) / feedback.length).toFixed(2)) : 0,
    };
  }

  private buildRecommendations(agent: AgentRecord, runs: AgentExecutionRecord[], feedback: AgentFeedbackRecord[]) {
    const comments = feedback.map((item) => `${item.comment ?? ''} ${item.improvementSuggestion ?? ''}`.toLowerCase()).join(' ');
    const recommendations: string[] = [];
    if (/generico|gen[eé]rico|general/.test(comments)) recommendations.push('Mejorar el prompt o plantilla para exigir contexto especifico y ejemplos por categoria.');
    if (/invent[oó]|inventado|dato falso/.test(comments)) recommendations.push('Reforzar la regla de no inventar datos y separar hechos extraidos de inferencias.');
    if (/seguridad|riesgo|legal/.test(comments)) recommendations.push('Agregar checklist de seguridad, riesgo o validacion legal segun el tipo de agente.');
    const metrics = this.buildMetrics(runs, feedback);
    if (metrics.executions > 0 && metrics.costTotal / metrics.executions > 0.02) recommendations.push('Reducir tokens enviados al LLM mediante resumen previo y limpieza documental.');
    if (!recommendations.length) recommendations.push(`Mantener monitoreo de feedback para ${agent.name}; aun no hay patrones recurrentes suficientes.`);
    return recommendations;
  }

  private summarizeInput(inputData: Record<string, unknown>) {
    const raw = JSON.stringify(inputData);
    return raw.length > 500 ? `${raw.slice(0, 500)}...` : raw;
  }

  private serializeAgent(agent: AgentRecord) {
    const status = agent.status ?? (agent.isActive ? 'active' : 'coming_soon');
    return {
      id: agent.agentKey ?? agent.id,
      agentKey: agent.agentKey ?? agent.id,
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
      status,
      visibleToBuyer: agent.visibleToBuyer ?? status !== 'hidden',
      isActive: status === 'active',
      accentColor: agent.accentColor,
      icon: agent.icon,
      sortOrder: agent.sortOrder ?? 99,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString(),
    };
  }

  private normalizeLegacyAgentKey(idOrSlug: string) {
    const legacyMap: Record<string, string> = {
      'agent-quote-comparator': 'proposal_comparison',
      'comparador-cotizaciones': 'proposal_comparison',
      'comparativos-propuestas-proveedores': 'proposal_comparison',
      'agent-terms-reference': 'terms_of_reference',
      'elaboracion-terminos-referencia': 'terms_of_reference',
    };
    return legacyMap[idOrSlug] ?? idOrSlug;
  }

  private findAgent(idOrSlug: string) {
    const normalized = this.normalizeLegacyAgentKey(idOrSlug);
    return this.agentsCollection().findOne({
      $or: [{ id: normalized }, { agentKey: normalized }, { slug: idOrSlug }],
    });
  }

  private agentsCollection() {
    return this.databaseService.collection<AgentRecord>('agents');
  }

  private executionsCollection() {
    return this.databaseService.collection<AgentExecutionRecord>('agentExecutions');
  }

  private feedbackCollection() {
    return this.databaseService.collection<AgentFeedbackRecord>('agentFeedback');
  }
}
