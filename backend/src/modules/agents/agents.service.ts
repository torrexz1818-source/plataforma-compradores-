import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { nodusIaAgents } from '../../../../shared/nodusIaAgents';
import { DatabaseService } from '../database/database.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/domain/user-role.enum';

export type AgentStatus = 'active' | 'coming_soon' | 'disabled' | 'hidden';
export type AgentPdfMode = 'standard_branded' | 'white_label' | 'custom_brand';
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

type AgentStatusOverrideRecord = {
  id: string;
  agentKey: string;
  status: AgentStatus;
  visibleToBuyer: boolean;
  isActive: boolean;
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

type UserPdfBrandingSettingsRecord = {
  id: string;
  userId: string;
  standardPdfEnabled: boolean;
  whiteLabelPdfEnabled: boolean;
  customBrandPdfEnabled: boolean;
  customBrandName?: string;
  customLogoUrl?: string;
  customPrimaryColor?: string;
  customFooterText?: string;
  premiumPdfStatus: 'active' | 'inactive';
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
};

type AgentPdfSettingsRecord = {
  id: string;
  agentKey: string;
  standardPdfEnabled: boolean;
  whiteLabelAvailable: boolean;
  customBrandAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ModuleRole = 'buyer' | 'supplier' | 'expert';
type ModuleActivationSettingsRecord = {
  id: string;
  role: ModuleRole;
  moduleKey: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type UploadedAgentFile = {
  fieldname: string;
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
};

type AgentRunFailureStage =
  | 'frontend_to_backend'
  | 'backend_to_ai_engine'
  | 'ai_provider_response'
  | 'timeout';

type AiErrorCode =
  | 'AI_ENGINE_NOT_CONFIGURED'
  | 'AI_ENGINE_INVALID_URL'
  | 'AI_ENGINE_UNREACHABLE'
  | 'AI_ENGINE_TIMEOUT'
  | 'AI_PROVIDER_ERROR'
  | 'AUTH_REQUIRED'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_AGENT_ERROR';

type AiEngineEndpointConfig = {
  path: string;
  mode: 'json' | 'multipart';
  provider: string;
};

const TOKEN_PRICING = {
  inputPerMillion: Number(process.env.AI_INPUT_TOKEN_USD_PER_MILLION ?? 0.15),
  outputPerMillion: Number(process.env.AI_OUTPUT_TOKEN_USD_PER_MILLION ?? 0.6),
};

const AGENT_CATALOG: Array<Omit<AgentRecord, 'createdAt' | 'updatedAt'>> = nodusIaAgents.map(
  ({ createdAt: _createdAt, updatedAt: _updatedAt, ...agent }) => agent,
);

const MODULE_DEFAULTS: Record<ModuleRole, Array<{ moduleKey: string; enabled: boolean }>> = {
  buyer: [
    { moduleKey: 'dashboard', enabled: false },
    { moduleKey: 'news', enabled: false },
    { moduleKey: 'community', enabled: false },
    { moduleKey: 'educational_content', enabled: false },
    { moduleKey: 'employability', enabled: false },
    { moduleKey: 'nodus_experts', enabled: false },
    { moduleKey: 'offers_requirements', enabled: false },
    { moduleKey: 'nodus_ia', enabled: true },
    { moduleKey: 'supplier_directory', enabled: false },
  ],
  supplier: [
    { moduleKey: 'dashboard', enabled: false },
    { moduleKey: 'buyer_directory', enabled: false },
    { moduleKey: 'posts', enabled: false },
    { moduleKey: 'stock_opportunities', enabled: false },
    { moduleKey: 'messages', enabled: false },
    { moduleKey: 'notifications', enabled: false },
    { moduleKey: 'reports', enabled: false },
  ],
  expert: [
    { moduleKey: 'nodus_ia', enabled: true },
  ],
};

const NODUS_IA_ALLOWED_ROLES = new Set<string>([
  UserRole.BUYER,
  UserRole.EXPERT,
  UserRole.ADMIN,
]);

const AI_ENGINE_UNAVAILABLE_MESSAGE =
  'No se pudo conectar con el motor de IA. Intenta nuevamente en unos minutos.';

const AI_ENGINE_ENDPOINTS: Record<string, AiEngineEndpointConfig> = {
  'proposal_comparison:analyze': {
    path: '/agents/proposal-comparison/analyze',
    mode: 'multipart',
    provider: 'anthropic',
  },
  'terms_of_reference:form_schema': {
    path: '/agents/terms-of-reference/form-schema',
    mode: 'json',
    provider: 'anthropic',
  },
  'terms_of_reference:generate': {
    path: '/agents/terms-of-reference/generate',
    mode: 'multipart',
    provider: 'anthropic',
  },
  'tco_analysis:analyze': {
    path: '/agents/tco-analysis/analyze',
    mode: 'multipart',
    provider: 'anthropic',
  },
  'dashboard_creator:generate': {
    path: '/agents/dashboard-creator/generate',
    mode: 'multipart',
    provider: 'anthropic',
  },
};

@Injectable()
export class AgentsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly usersService: UsersService,
  ) {}

  async listAgents(filters?: { category?: string; automationType?: string; includeHidden?: boolean }) {
    try {
      await this.ensureAgentCatalog();
      const query: Record<string, unknown> = {
        agentKey: { $in: AGENT_CATALOG.map((agent) => agent.agentKey) },
      };

      if (filters?.category?.trim()) query.category = filters.category.trim();
      if (filters?.automationType?.trim()) query.automationType = filters.automationType.trim();

      const agents = await this.agentsCollection().find(query).sort({ sortOrder: 1, name: 1 }).toArray();
      const agentsWithStatus = await this.applyAgentStatusOverrides(agents);
      return agentsWithStatus
        .filter((agent) => filters?.includeHidden || (agent.visibleToBuyer && agent.status !== 'hidden'))
        .map((agent) => this.serializeAgent(agent));
    } catch {
      return this.getCatalogFallbackAgentsWithOverrides(filters);
    }
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
    try {
      await this.ensureAgentCatalog();
      const [agents, runs, feedback] = await Promise.all([
        this.agentsCollection().find({ agentKey: { $in: AGENT_CATALOG.map((agent) => agent.agentKey) } }).sort({ sortOrder: 1, name: 1 }).toArray(),
        this.executionsCollection().find({}).toArray(),
        this.feedbackCollection().find({}).toArray(),
      ]);

      const agentsWithStatus = await this.applyAgentStatusOverrides(agents);

      return agentsWithStatus.map((agent) => {
        const agentRuns = runs.filter((run) => (run.agentKey || run.agentId) === agent.agentKey);
        const agentFeedback = feedback.filter((item) => item.agentKey === agent.agentKey);
        return {
          ...this.serializeAgent(agent),
          metrics: this.buildMetrics(agentRuns, agentFeedback),
          recommendations: this.buildRecommendations(agent, agentRuns, agentFeedback),
        };
      });
    } catch {
      const fallbackAgents = await this.getCatalogFallbackAgentsWithOverrides({ includeHidden: true });
      return fallbackAgents.map((agent) => ({
        ...agent,
        metrics: this.buildMetrics([], []),
        recommendations: [`Mantener monitoreo de feedback para ${agent.name}; aun no hay patrones recurrentes suficientes.`],
      }));
    }
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
        modelProvider: execution.modelProvider ?? 'anthropic',
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
      modelProvider: 'anthropic',
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
    try {
      await this.ensureAgentCatalog();
    } catch {
      // Updating a status must not fail because catalog hydration had a production DB issue.
    }

    if (!['active', 'coming_soon', 'disabled', 'hidden'].includes(status)) {
      throw new BadRequestException('Estado de agente invalido');
    }

    const agent = (await this.findAgent(agentKey).catch(() => null)) ?? this.findCatalogAgent(agentKey);
    if (!agent) throw new NotFoundException('Agente no encontrado');

    const now = new Date();
    const statusPatch = {
      status,
      isActive: status === 'active',
      visibleToBuyer: status !== 'hidden',
      updatedAt: now,
    };
    const updatedAgent: AgentRecord = {
      ...agent,
      ...statusPatch,
    };

    try {
      await this.agentsCollection().updateOne(
        { agentKey: agent.agentKey },
        {
          $setOnInsert: {
            ...this.findCatalogAgent(agent.agentKey),
            createdAt: now,
          },
          $set: statusPatch,
        },
        { upsert: true },
      );
    } catch {
      // The admin action still returns the selected state; the override below is the durable source.
    }

    try {
      await this.agentStatusSettingsCollection().updateOne(
        { agentKey: agent.agentKey },
        {
          $setOnInsert: {
            id: randomUUID(),
            agentKey: agent.agentKey,
            createdAt: now,
          },
          $set: statusPatch,
        },
        { upsert: true },
      );
    } catch {
      // Avoid breaking the UI with a 500 if the secondary status store has a transient issue.
    }

    return { agent: this.serializeAgent(updatedAgent), message: 'Estado actualizado correctamente' };
  }

  async getUserPdfBrandingSettingsForAdmin(userId: string) {
    await this.usersService.requireActiveUser(userId);
    return this.serializeUserPdfBrandingSettings(await this.getOrCreateUserPdfBrandingSettings(userId));
  }

  async updateUserPdfBrandingSettingsForAdmin(
    userId: string,
    payload: Partial<Pick<
      UserPdfBrandingSettingsRecord,
      | 'standardPdfEnabled'
      | 'whiteLabelPdfEnabled'
      | 'customBrandPdfEnabled'
      | 'customBrandName'
      | 'customLogoUrl'
      | 'customPrimaryColor'
      | 'customFooterText'
      | 'premiumPdfStatus'
      | 'adminNotes'
    >>,
  ) {
    await this.usersService.requireActiveUser(userId);
    const current = await this.getOrCreateUserPdfBrandingSettings(userId);
    const now = new Date();
    const updates: Partial<UserPdfBrandingSettingsRecord> = { updatedAt: now };

    if (typeof payload.standardPdfEnabled === 'boolean') updates.standardPdfEnabled = payload.standardPdfEnabled;
    if (typeof payload.whiteLabelPdfEnabled === 'boolean') updates.whiteLabelPdfEnabled = payload.whiteLabelPdfEnabled;
    if (typeof payload.customBrandPdfEnabled === 'boolean') updates.customBrandPdfEnabled = payload.customBrandPdfEnabled;
    if (typeof payload.customBrandName === 'string') updates.customBrandName = payload.customBrandName.trim();
    if (typeof payload.customLogoUrl === 'string') updates.customLogoUrl = payload.customLogoUrl.trim();
    if (typeof payload.customPrimaryColor === 'string') updates.customPrimaryColor = payload.customPrimaryColor.trim();
    if (typeof payload.customFooterText === 'string') updates.customFooterText = payload.customFooterText.trim();
    if (typeof payload.adminNotes === 'string') updates.adminNotes = payload.adminNotes.trim();
    if (payload.premiumPdfStatus === 'active' || payload.premiumPdfStatus === 'inactive') {
      updates.premiumPdfStatus = payload.premiumPdfStatus;
    }

    await this.userPdfBrandingSettingsCollection().updateOne({ id: current.id }, { $set: updates });
    return this.getUserPdfBrandingSettingsForAdmin(userId);
  }

  async getAgentPdfSettingsForAdmin(agentKey: string) {
    const agent = await this.findAgent(agentKey);
    if (!agent) throw new NotFoundException('Agente no encontrado');
    return this.serializeAgentPdfSettings(await this.getOrCreateAgentPdfSettings(agent.agentKey));
  }

  async updateAgentPdfSettingsForAdmin(
    agentKey: string,
    payload: Partial<Pick<AgentPdfSettingsRecord, 'standardPdfEnabled' | 'whiteLabelAvailable' | 'customBrandAvailable'>>,
  ) {
    const agent = await this.findAgent(agentKey);
    if (!agent) throw new NotFoundException('Agente no encontrado');
    const current = await this.getOrCreateAgentPdfSettings(agent.agentKey);
    const updates: Partial<AgentPdfSettingsRecord> = { updatedAt: new Date() };

    if (typeof payload.standardPdfEnabled === 'boolean') updates.standardPdfEnabled = payload.standardPdfEnabled;
    if (typeof payload.whiteLabelAvailable === 'boolean') updates.whiteLabelAvailable = payload.whiteLabelAvailable;
    if (typeof payload.customBrandAvailable === 'boolean') updates.customBrandAvailable = payload.customBrandAvailable;

    await this.agentPdfSettingsCollection().updateOne({ id: current.id }, { $set: updates });
    return this.getAgentPdfSettingsForAdmin(agent.agentKey);
  }

  async getPdfOptionsForUser(userId: string, agentKey: string) {
    const agent = await this.findAgent(agentKey);
    if (!agent) throw new NotFoundException('Agente no encontrado');
    const [user, membership, userSettings, agentSettings] = await Promise.all([
      this.usersService.requireActiveUser(userId),
      this.usersService.getMembershipByUserId(userId),
      this.getOrCreateUserPdfBrandingSettings(userId),
      this.getOrCreateAgentPdfSettings(agent.agentKey),
    ]);
    const plan = membership?.plan ?? 'free';
    const planAllowsWhiteLabel = plan === 'professional' || plan === 'premium';
    const planAllowsCustomBrand = plan === 'premium';
    const premiumActive = userSettings.premiumPdfStatus === 'active';
    const isAdmin = user.role === UserRole.ADMIN;
    const userAllowsWhiteLabel = isAdmin || planAllowsWhiteLabel || (premiumActive && userSettings.whiteLabelPdfEnabled);
    const userAllowsCustomBrand = isAdmin || planAllowsCustomBrand || (premiumActive && userSettings.customBrandPdfEnabled);
    const modes = {
      standardBranded: userSettings.standardPdfEnabled && agentSettings.standardPdfEnabled,
      whiteLabel: userAllowsWhiteLabel && agentSettings.whiteLabelAvailable,
      customBrand: userAllowsCustomBrand && agentSettings.customBrandAvailable,
    };

    return {
      agentKey: agent.agentKey,
      modes,
      branding: {
        companyName: userSettings.customBrandName || user.commercialName || user.company,
        logoUrl: membership?.companyLogoUrl || userSettings.customLogoUrl || user.avatarUrl,
        primaryColor: userSettings.customPrimaryColor || agent.accentColor,
        footerText: userSettings.customFooterText,
      },
    };
  }

  async assertPdfModeAllowed(userId: string, agentKey: string, mode: AgentPdfMode) {
    const options = await this.getPdfOptionsForUser(userId, agentKey);
    const allowed =
      mode === 'standard_branded'
        ? options.modes.standardBranded
        : mode === 'white_label'
          ? options.modes.whiteLabel
          : options.modes.customBrand;

    if (!allowed) {
      throw new ForbiddenException('No tienes permiso para descargar este formato de PDF.');
    }

    return { allowed: true, options };
  }

  async listModuleActivationSettingsForAdmin() {
    await this.ensureModuleActivationDefaults();
    return this.moduleActivationSettingsCollection()
      .find({})
      .sort({ role: 1, moduleKey: 1 })
      .toArray()
      .then((items) => items.map((item) => this.serializeModuleActivationSettings(item)));
  }

  async getModuleActivationSettingsForUser(role: string) {
    const normalizedRole = this.normalizeModuleRole(role);
    if (role === UserRole.ADMIN) {
      await this.ensureModuleActivationDefaults();
      const items = await this.moduleActivationSettingsCollection().find({}).toArray();
      return {
        role,
        modules: items.map((item) => this.serializeModuleActivationSettings(item)),
      };
    }

    if (!normalizedRole) {
      return { role, modules: [] };
    }

    await this.ensureModuleActivationDefaults();
    const items = await this.moduleActivationSettingsCollection().find({ role: normalizedRole }).toArray();
    return {
      role: normalizedRole,
      modules: items.map((item) => this.serializeModuleActivationSettings(item)),
    };
  }

  async updateModuleActivationSettingForAdmin(role: string, moduleKey: string, enabled: boolean) {
    const normalizedRole = this.normalizeModuleRole(role);
    if (!normalizedRole) throw new BadRequestException('Rol invalido');
    await this.ensureModuleActivationDefaults();

    const now = new Date();
    await this.moduleActivationSettingsCollection().updateOne(
      { role: normalizedRole, moduleKey },
      {
        $set: { enabled, updatedAt: now },
        $setOnInsert: { id: randomUUID(), role: normalizedRole, moduleKey, createdAt: now },
      },
      { upsert: true },
    );

    return this.moduleActivationSettingsCollection()
      .findOne({ role: normalizedRole, moduleKey })
      .then((item) => item ? this.serializeModuleActivationSettings(item) : null);
  }

  async activateAgent(agentId: string) {
    return this.updateAgentStatus(agentId, 'active');
  }

  async runAgent(input: {
    agentId: string;
    userId: string;
    userRole?: string;
    inputData: Record<string, unknown>;
    aiOperation?: string;
    formFields?: Record<string, unknown>;
    files?: UploadedAgentFile[];
    requestMeta?: { traceId?: string; country?: string };
  }) {
    await this.ensureAgentCatalog();
    const [agent, user] = await Promise.all([this.findAgent(input.agentId), this.usersService.requireActiveUser(input.userId)]);

    if (!agent) throw new NotFoundException('Agente no encontrado');
    if (!NODUS_IA_ALLOWED_ROLES.has(user.role)) {
      throw new ForbiddenException('Nodus IA esta disponible para compradores, expertos y administradores');
    }
    if (agent.status !== 'active' && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(agent.status === 'coming_soon' ? 'Este agente estara disponible proximamente' : 'Este agente no esta disponible');
    }

    if (input.aiOperation?.trim()) {
      return this.runAiEngineAgent({ ...input, agent, userName: user.fullName, userRole: user.role });
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
      modelProvider: 'anthropic',
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

  async getAiHealth(requestMeta?: { traceId?: string; country?: string }) {
    const traceId = requestMeta?.traceId || randomUUID();
    const aiEngineBaseUrl = this.getAiEngineBaseUrl();
    const provider = this.getPrimaryProvider();
    const timeoutMs = this.getAiHealthTimeoutMs();
    const startedAt = Date.now();
    const checkedUrlHost = this.getUrlHost(aiEngineBaseUrl);

    if (!aiEngineBaseUrl) {
      this.logAiEvent({
        endpoint: '/ai/health',
        traceId,
        country: requestMeta?.country,
        provider,
        stage: 'backend_to_ai_engine',
        statusCode: 503,
        latencyMs: Date.now() - startedAt,
        message: 'AI_ENGINE_URL is not configured',
        errorCode: 'AI_ENGINE_NOT_CONFIGURED',
      });

      return this.buildAiHealthResponse({
        ok: false,
        aiEngineConfigured: false,
        aiEngineReachable: false,
        provider,
        timeoutMs,
        checkedUrlHost,
        errorCode: 'AI_ENGINE_NOT_CONFIGURED',
        message: 'AI_ENGINE_URL no esta configurado en el backend.',
        traceId,
      });
    }

    if (!this.isValidProductionAiEngineUrl(aiEngineBaseUrl)) {
      this.logAiEvent({
        endpoint: '/ai/health',
        traceId,
        country: requestMeta?.country,
        provider,
        stage: 'backend_to_ai_engine',
        statusCode: 503,
        latencyMs: Date.now() - startedAt,
        message: `Invalid AI_ENGINE_URL host: ${checkedUrlHost || 'unknown'}`,
        errorCode: 'AI_ENGINE_INVALID_URL',
      });

      return this.buildAiHealthResponse({
        ok: false,
        aiEngineConfigured: false,
        aiEngineReachable: false,
        provider,
        timeoutMs,
        checkedUrlHost,
        errorCode: 'AI_ENGINE_INVALID_URL',
        message: 'AI_ENGINE_URL debe ser una URL absoluta https/http accesible desde el backend.',
        traceId,
      });
    }

    const healthUrl = `${aiEngineBaseUrl}/health`;

    try {
      const response = await this.fetchWithTimeout(healthUrl, { method: 'GET' }, timeoutMs);
      this.logAiEvent({
        endpoint: '/ai/health',
        traceId,
        country: requestMeta?.country,
        provider,
        stage: 'ai_provider_response',
        statusCode: response.status,
        latencyMs: Date.now() - startedAt,
        errorCode: response.ok ? null : 'AI_ENGINE_UNREACHABLE',
      });

      return this.buildAiHealthResponse({
        ok: response.ok,
        aiEngineConfigured: true,
        aiEngineReachable: response.ok,
        provider,
        timeoutMs,
        checkedUrlHost,
        errorCode: response.ok ? null : 'AI_ENGINE_UNREACHABLE',
        message: response.ok
          ? 'Backend y AI Engine responden correctamente.'
          : `AI Engine respondio con status ${response.status}.`,
        traceId,
      });
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      const errorCode: AiErrorCode = isTimeout ? 'AI_ENGINE_TIMEOUT' : 'AI_ENGINE_UNREACHABLE';
      this.logAiEvent({
        endpoint: '/ai/health',
        traceId,
        country: requestMeta?.country,
        provider,
        stage: isTimeout ? 'timeout' : 'backend_to_ai_engine',
        statusCode: 503,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error),
        errorCode,
      });

      return this.buildAiHealthResponse({
        ok: false,
        aiEngineConfigured: true,
        aiEngineReachable: false,
        provider,
        timeoutMs,
        checkedUrlHost,
        errorCode,
        message: isTimeout
          ? 'Timeout al consultar el AI Engine desde el backend.'
          : 'El backend no pudo alcanzar el AI Engine.',
        traceId,
      });
    }
  }

  async getAiDeepHealth(requestMeta?: { traceId?: string; country?: string }) {
    const traceId = requestMeta?.traceId || randomUUID();
    const provider = this.getPrimaryProvider();
    const timeoutMs = this.getAiHealthTimeoutMs();
    const aiEngineBaseUrl = this.getAiEngineBaseUrl();
    const checkedUrlHost = this.getUrlHost(aiEngineBaseUrl);

    if (process.env.AI_DEEP_HEALTH_ENABLED?.toLowerCase() !== 'true') {
      return {
        ...this.buildAiHealthResponse({
          ok: false,
          aiEngineConfigured: Boolean(aiEngineBaseUrl),
          aiEngineReachable: false,
          provider,
          timeoutMs,
          checkedUrlHost,
          errorCode: 'VALIDATION_ERROR',
          message: 'Health profundo deshabilitado. Activa AI_DEEP_HEALTH_ENABLED=true para ejecutarlo.',
          traceId,
        }),
        deep: { enabled: false },
      };
    }

    const baseHealth = await this.getAiHealth({ traceId, country: requestMeta?.country });
    if (!baseHealth.ok || !aiEngineBaseUrl) {
      return {
        ...baseHealth,
        deep: { enabled: true, providerReachable: false },
      };
    }

    const startedAt = Date.now();
    try {
      const response = await this.fetchWithTimeout(`${aiEngineBaseUrl}/health/deep`, { method: 'GET' }, timeoutMs);
      const body = this.parseAiEngineResponse(await response.text());
      const providerReachable = response.ok && body.provider_reachable !== false;
      const errorCode: AiErrorCode | null = providerReachable ? null : 'AI_PROVIDER_ERROR';

      this.logAiEvent({
        endpoint: '/api/ai/health/deep',
        traceId,
        country: requestMeta?.country,
        provider,
        stage: 'ai_provider_response',
        statusCode: response.status,
        latencyMs: Date.now() - startedAt,
        errorCode,
        message: typeof body.message === 'string' ? body.message : undefined,
      });

      return {
        ...this.buildAiHealthResponse({
          ok: providerReachable,
          aiEngineConfigured: true,
          aiEngineReachable: response.ok,
          provider,
          timeoutMs,
          checkedUrlHost,
          errorCode,
          message: providerReachable
            ? 'Backend, AI Engine y proveedor IA responden correctamente.'
            : 'El AI Engine responde, pero el proveedor IA no esta disponible.',
          traceId,
        }),
        deep: {
          enabled: true,
          providerReachable,
          statusCode: response.status,
        },
      };
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      const errorCode: AiErrorCode = isTimeout ? 'AI_ENGINE_TIMEOUT' : 'AI_PROVIDER_ERROR';

      this.logAiEvent({
        endpoint: '/api/ai/health/deep',
        traceId,
        country: requestMeta?.country,
        provider,
        stage: isTimeout ? 'timeout' : 'ai_provider_response',
        statusCode: 503,
        latencyMs: Date.now() - startedAt,
        errorCode,
        message: error instanceof Error ? error.message : String(error),
      });

      return {
        ...this.buildAiHealthResponse({
          ok: false,
          aiEngineConfigured: true,
          aiEngineReachable: !isTimeout,
          provider,
          timeoutMs,
          checkedUrlHost,
          errorCode,
          message: isTimeout
            ? 'Timeout durante el health profundo.'
            : 'No se pudo completar el health profundo del proveedor IA.',
          traceId,
        }),
        deep: {
          enabled: true,
          providerReachable: false,
        },
      };
    }
  }

  private async runAiEngineAgent(input: {
    agentId: string;
    userId: string;
    userRole?: string;
    inputData: Record<string, unknown>;
    aiOperation?: string;
    formFields?: Record<string, unknown>;
    files?: UploadedAgentFile[];
    requestMeta?: { traceId?: string; country?: string };
    agent: AgentRecord;
    userName: string;
  }) {
    const traceId = input.requestMeta?.traceId || randomUUID();
    const startedAt = Date.now();
    const agentKey = input.agent.agentKey;
    const operation = input.aiOperation?.trim() || 'run';
    const endpointConfig = AI_ENGINE_ENDPOINTS[`${agentKey}:${operation}`];
    const provider = endpointConfig?.provider ?? this.getPrimaryProvider();

    if (!endpointConfig) {
      return this.buildFailedAiExecution({
        input,
        traceId,
        provider,
        startedAt,
        stage: 'frontend_to_backend',
        statusCode: 400,
        errorCode: 'UNKNOWN_AGENT_ERROR',
        message: 'Operacion de agente no soportada.',
      });
    }

    this.logAiEvent({
      endpoint: '/agents/run',
      traceId,
      country: input.requestMeta?.country,
      provider,
      stage: 'frontend_to_backend',
      statusCode: 202,
      agentKey,
      operation,
    });

    const aiEngineBaseUrl = this.getAiEngineBaseUrl();
    if (!aiEngineBaseUrl) {
      return this.buildFailedAiExecution({
        input,
        traceId,
        provider,
        startedAt,
        stage: 'backend_to_ai_engine',
        statusCode: 503,
        errorCode: 'AI_ENGINE_NOT_CONFIGURED',
        message: AI_ENGINE_UNAVAILABLE_MESSAGE,
        diagnosticMessage: 'AI_ENGINE_URL is not configured',
      });
    }

    if (!this.isValidProductionAiEngineUrl(aiEngineBaseUrl)) {
      return this.buildFailedAiExecution({
        input,
        traceId,
        provider,
        startedAt,
        stage: 'backend_to_ai_engine',
        statusCode: 503,
        errorCode: 'AI_ENGINE_INVALID_URL',
        message: AI_ENGINE_UNAVAILABLE_MESSAGE,
        diagnosticMessage: `Invalid AI_ENGINE_URL host: ${this.getUrlHost(aiEngineBaseUrl) || 'unknown'}`,
      });
    }

    const aiEngineUrl = `${aiEngineBaseUrl}${endpointConfig.path}`;

    try {
      const response = await this.fetchWithTimeout(
        aiEngineUrl,
        this.buildAiEngineRequest(endpointConfig, input.formFields ?? {}, input.files ?? []),
        this.getAgentTimeoutMs(agentKey),
      );
      const responseText = await response.text();

      if (!response.ok) {
        const message = this.extractAiEngineErrorMessage(responseText) || AI_ENGINE_UNAVAILABLE_MESSAGE;
        return this.buildFailedAiExecution({
          input,
          traceId,
          provider,
          startedAt,
          stage: 'ai_provider_response',
          statusCode: response.status,
          errorCode: response.status >= 500 ? 'AI_PROVIDER_ERROR' : 'AI_ENGINE_UNREACHABLE',
          message: response.status >= 500 ? AI_ENGINE_UNAVAILABLE_MESSAGE : message,
          diagnosticMessage: message,
        });
      }

      const outputData = this.parseAiEngineResponse(responseText);
      const execution = await this.persistAiExecution({
        input,
        traceId,
        outputData,
        provider,
        modelName: this.extractModelName(outputData),
        status: 'completed',
        startedAt,
      });

      this.logAiEvent({
        endpoint: endpointConfig.path,
        traceId,
        country: input.requestMeta?.country,
        provider,
        stage: 'ai_provider_response',
        statusCode: response.status,
        latencyMs: Date.now() - startedAt,
        agentKey,
        operation,
      });

      return {
        ok: true,
        errorCode: null,
        message: 'Agente ejecutado correctamente.',
        traceId,
        execution,
      };
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      return this.buildFailedAiExecution({
        input,
        traceId,
        provider,
        startedAt,
        stage: isTimeout ? 'timeout' : 'backend_to_ai_engine',
        statusCode: 503,
        errorCode: isTimeout ? 'AI_ENGINE_TIMEOUT' : 'AI_ENGINE_UNREACHABLE',
        message: AI_ENGINE_UNAVAILABLE_MESSAGE,
        diagnosticMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private buildAiEngineRequest(
    endpointConfig: AiEngineEndpointConfig,
    fields: Record<string, unknown>,
    files: UploadedAgentFile[],
  ): RequestInit {
    if (endpointConfig.mode === 'json') {
      return {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.buildAiEngineJsonBody(fields)),
      };
    }

    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      if (key === 'agentId' || key === 'operation' || key === 'inputData' || typeof value === 'undefined') return;
      if (Array.isArray(value)) {
        value.forEach((item) => formData.append(key, String(item)));
        return;
      }
      formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
    });

    files.forEach((file) => {
      const blob = new Blob([file.buffer as unknown as BlobPart], {
        type: file.mimetype || 'application/octet-stream',
      });
      formData.append(file.fieldname || 'files', blob, file.originalname || 'archivo');
    });

    return {
      method: 'POST',
      body: formData,
    };
  }

  private buildAiEngineJsonBody(fields: Record<string, unknown>) {
    const inputData = fields.inputData;
    if (inputData && typeof inputData === 'object' && !Array.isArray(inputData)) {
      return inputData;
    }

    if (typeof fields.initial_description === 'string') {
      return { initial_description: fields.initial_description };
    }

    return fields;
  }

  private async buildFailedAiExecution(input: {
    input: {
      agentId: string;
      userId: string;
      userRole?: string;
      inputData: Record<string, unknown>;
      formFields?: Record<string, unknown>;
      requestMeta?: { traceId?: string; country?: string };
      agent: AgentRecord;
    };
    traceId: string;
    provider: string;
    startedAt: number;
    stage: AgentRunFailureStage;
    statusCode: number;
    errorCode: AiErrorCode;
    message: string;
    diagnosticMessage?: string;
  }) {
    const outputData = {
      ok: false,
      errorCode: input.errorCode,
      message: input.message || AI_ENGINE_UNAVAILABLE_MESSAGE,
      execution: null,
      traceId: input.traceId,
    };
    const execution = await this.persistAiExecution({
      input: input.input,
      traceId: input.traceId,
      outputData,
      provider: input.provider,
      modelName: 'unavailable',
      status: 'failed',
      errorMessage: input.message,
      startedAt: input.startedAt,
    });

    this.logAiEvent({
      endpoint: '/agents/run',
      traceId: input.traceId,
      country: input.input.requestMeta?.country,
      provider: input.provider,
      stage: input.stage,
      statusCode: input.statusCode,
      latencyMs: Date.now() - input.startedAt,
      agentKey: input.input.agent.agentKey,
      errorCode: input.errorCode,
      message: input.diagnosticMessage ?? input.message,
    });

    return {
      ok: false,
      errorCode: input.errorCode,
      message: input.message || AI_ENGINE_UNAVAILABLE_MESSAGE,
      traceId: input.traceId,
      execution,
    };
  }

  private async persistAiExecution(input: {
    input: {
      agentId: string;
      userId: string;
      userRole?: string;
      inputData: Record<string, unknown>;
      formFields?: Record<string, unknown>;
      files?: UploadedAgentFile[];
      agent: AgentRecord;
    };
    traceId: string;
    outputData: Record<string, unknown>;
    provider: string;
    modelName?: string;
    status: 'completed' | 'failed';
    errorMessage?: string;
    startedAt: number;
  }) {
    const agent = input.input.agent;
    const inputData = this.buildStoredAiInput(input.input.inputData, input.input.formFields ?? {});
    const tokenStats = this.normalizeTokenUsage({ inputData, outputData: input.outputData });
    const now = new Date();
    const execution: AgentExecutionRecord = {
      id: randomUUID(),
      agentRunId: input.traceId,
      agentId: agent.id,
      agentKey: agent.agentKey,
      agentName: agent.name,
      userId: input.input.userId,
      userRole: input.input.userRole ?? 'buyer',
      inputData,
      inputSummary: this.summarizeInput(inputData),
      inputPayloadJson: inputData,
      outputData: input.outputData,
      outputJson: input.outputData,
      outputText: String(input.outputData.summary ?? input.outputData.executive_summary ?? input.outputData.message ?? ''),
      status: input.status,
      errorMessage: input.errorMessage,
      operationName: 'Ejecucion de agente IA',
      modelProvider: input.provider,
      modelName: input.modelName ?? 'No especificado',
      model: input.modelName ?? 'No especificado',
      ...tokenStats,
      latencyMs: Date.now() - input.startedAt,
      fileCount: input.input.files?.length ?? 0,
      fileTypesJson: input.input.files?.map((file) => file.mimetype) ?? [],
      approxTotalFileSize: input.input.files?.reduce((total, file) => total + file.size, 0) ?? 0,
      pdfGenerated: false,
      executedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await this.executionsCollection().insertOne(execution);
    return {
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
    };
  }

  private getAiEngineBaseUrl() {
    const configuredUrl =
      process.env.AI_ENGINE_URL?.trim() ||
      process.env.BUYER_NODUS_AI_ENGINE_URL?.trim() ||
      (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:8000');

    return configuredUrl.replace(/\/$/, '');
  }

  private buildAiHealthResponse(input: {
    ok: boolean;
    aiEngineConfigured: boolean;
    aiEngineReachable: boolean;
    provider: string;
    timeoutMs: number;
    checkedUrlHost: string;
    errorCode: AiErrorCode | null;
    message: string;
    traceId: string;
  }) {
    return {
      ok: input.ok,
      backend: 'ok',
      aiEngineConfigured: input.aiEngineConfigured,
      aiEngineReachable: input.aiEngineReachable,
      provider: input.provider,
      timeoutMs: input.timeoutMs,
      checkedUrlHost: input.checkedUrlHost,
      errorCode: input.errorCode,
      message: input.message,
      traceId: input.traceId,
    };
  }

  private getUrlHost(url: string) {
    if (!url) return '';

    try {
      return new URL(url).host;
    } catch {
      return '';
    }
  }

  private isValidProductionAiEngineUrl(url: string) {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') return false;
      if (parsedUrl.pathname && parsedUrl.pathname !== '/') return false;
      if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') return false;
      if (parsedUrl.hostname === '0.0.0.0' || parsedUrl.hostname === '::1') return false;
      if (this.isPrivateIpv4Host(parsedUrl.hostname)) return false;
      return true;
    } catch {
      return false;
    }
  }

  private isPrivateIpv4Host(hostname: string) {
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return false;
    const octets = hostname.split('.').map((part) => Number(part));
    if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) return false;
    return (
      octets[0] === 10 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    );
  }

  private getPrimaryProvider() {
    return 'anthropic';
  }

  private isFallbackProviderConfigured() {
    return false;
  }

  private getAgentTimeoutMs(agentKey: string) {
    const specificTimeout = process.env[`AI_AGENT_TIMEOUT_MS_${agentKey.toUpperCase()}`]?.trim();
    return Number.parseInt(specificTimeout || process.env.AI_AGENT_TIMEOUT_MS || '', 10) || 120_000;
  }

  private getAiHealthTimeoutMs() {
    return Number.parseInt(process.env.AI_HEALTH_TIMEOUT_MS || '', 10) || 10_000;
  }

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseAiEngineResponse(responseText: string): Record<string, unknown> {
    if (!responseText.trim()) {
      return {};
    }

    try {
      const parsed = JSON.parse(responseText) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : { result: parsed };
    } catch {
      return { result: responseText };
    }
  }

  private extractAiEngineErrorMessage(responseText: string) {
    const parsed = this.parseAiEngineResponse(responseText);
    const detail = parsed.detail;
    const message = parsed.message;

    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) =>
          item && typeof item === 'object' && 'msg' in item
            ? String((item as { msg: unknown }).msg)
            : String(item),
        )
        .join(', ');
    }
    if (typeof message === 'string') return message;
    return '';
  }

  private extractModelName(outputData: Record<string, unknown>) {
    return typeof outputData.model_name === 'string'
      ? outputData.model_name
      : process.env.ANTHROPIC_MODEL?.trim() || 'ai-engine';
  }

  private buildStoredAiInput(inputData: Record<string, unknown>, formFields: Record<string, unknown>) {
    if (Object.keys(inputData).length) {
      return inputData;
    }

    return Object.fromEntries(
      Object.entries(formFields).filter(([key]) => key !== 'inputData'),
    );
  }

  private isEnvPresent(name: string) {
    return Boolean(process.env[name]?.trim());
  }

  private logAiEvent(event: {
    endpoint: string;
    traceId: string;
    country?: string;
    provider: string;
    stage: AgentRunFailureStage;
    statusCode: number;
    latencyMs?: number;
    agentKey?: string;
    operation?: string;
    message?: string;
    errorCode?: AiErrorCode | null;
  }) {
    const payload = {
      scope: 'nodus_ia',
      endpoint: event.endpoint,
      country: event.country || 'unknown',
      provider: event.provider,
      stage: event.stage,
      statusCode: event.statusCode,
      traceId: event.traceId,
      latencyMs: event.latencyMs,
      agentKey: event.agentKey,
      operation: event.operation,
      errorCode: event.errorCode,
      message: event.message,
    };

    if (event.statusCode >= 400 || event.stage === 'timeout') {
      console.error(JSON.stringify(payload));
      return;
    }

    console.log(JSON.stringify(payload));
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
    const currentAgentKeys = AGENT_CATALOG.map((agent) => agent.agentKey);

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

    await this.agentsCollection().deleteMany(
      {
        $or: [
          { agentKey: { $exists: false } },
          { agentKey: { $nin: currentAgentKeys } },
        ],
      }
    );
  }

  private async ensureModuleActivationDefaults() {
    const now = new Date();
    await Promise.all(
      Object.entries(MODULE_DEFAULTS).flatMap(([role, modules]) =>
        modules.map((module) =>
          this.moduleActivationSettingsCollection().updateOne(
            { role: role as ModuleRole, moduleKey: module.moduleKey },
            {
              $setOnInsert: {
                id: randomUUID(),
                role: role as ModuleRole,
                moduleKey: module.moduleKey,
                enabled: module.enabled,
                createdAt: now,
                updatedAt: now,
              },
            },
            { upsert: true },
          ),
        ),
      ),
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
      createdAt: this.serializeDate(agent.createdAt),
      updatedAt: this.serializeDate(agent.updatedAt),
    };
  }

  private getCatalogFallbackAgents(filters?: { category?: string; automationType?: string; includeHidden?: boolean }) {
    return this.getCatalogFallbackAgentRecords().map((agent) => this.serializeAgent(agent)).filter((agent) => {
      const visible = filters?.includeHidden || agent.status !== 'hidden';
      const matchesCategory = !filters?.category?.trim() || agent.category === filters.category.trim();
      const matchesAutomation = !filters?.automationType?.trim() || agent.automationType === filters.automationType.trim();
      return visible && matchesCategory && matchesAutomation;
    });
  }

  private async getCatalogFallbackAgentsWithOverrides(filters?: { category?: string; automationType?: string; includeHidden?: boolean }) {
    const agentsWithStatus = await this.applyAgentStatusOverrides(this.getCatalogFallbackAgentRecords());
    return agentsWithStatus.map((agent) => this.serializeAgent(agent)).filter((agent) => {
      const visible = filters?.includeHidden || agent.status !== 'hidden';
      const matchesCategory = !filters?.category?.trim() || agent.category === filters.category.trim();
      const matchesAutomation = !filters?.automationType?.trim() || agent.automationType === filters.automationType.trim();
      return visible && matchesCategory && matchesAutomation;
    });
  }

  private getCatalogFallbackAgentRecords(): AgentRecord[] {
    const now = new Date();
    return AGENT_CATALOG.map((agent) => ({
      ...agent,
      createdAt: now,
      updatedAt: now,
    }));
  }

  private async getOrCreateUserPdfBrandingSettings(userId: string) {
    const existing = await this.userPdfBrandingSettingsCollection().findOne({ userId });
    if (existing) return existing;

    const now = new Date();
    const settings: UserPdfBrandingSettingsRecord = {
      id: randomUUID(),
      userId,
      standardPdfEnabled: true,
      whiteLabelPdfEnabled: false,
      customBrandPdfEnabled: false,
      premiumPdfStatus: 'inactive',
      createdAt: now,
      updatedAt: now,
    };
    await this.userPdfBrandingSettingsCollection().insertOne(settings);
    return settings;
  }

  private async getOrCreateAgentPdfSettings(agentKey: string) {
    const existing = await this.agentPdfSettingsCollection().findOne({ agentKey });
    if (existing) return existing;

    const now = new Date();
    const settings: AgentPdfSettingsRecord = {
      id: randomUUID(),
      agentKey,
      standardPdfEnabled: true,
      whiteLabelAvailable: false,
      customBrandAvailable: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.agentPdfSettingsCollection().insertOne(settings);
    return settings;
  }

  private serializeUserPdfBrandingSettings(settings: UserPdfBrandingSettingsRecord) {
    return {
      ...settings,
      createdAt: this.serializeDate(settings.createdAt),
      updatedAt: this.serializeDate(settings.updatedAt),
    };
  }

  private serializeAgentPdfSettings(settings: AgentPdfSettingsRecord) {
    return {
      ...settings,
      createdAt: this.serializeDate(settings.createdAt),
      updatedAt: this.serializeDate(settings.updatedAt),
    };
  }

  private serializeModuleActivationSettings(settings: ModuleActivationSettingsRecord) {
    return {
      ...settings,
      createdAt: this.serializeDate(settings.createdAt),
      updatedAt: this.serializeDate(settings.updatedAt),
    };
  }

  private serializeDate(value: Date | string | undefined) {
    try {
      if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
      if (typeof value === 'string' && value.trim()) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
      }
    } catch {
      // Fall through to a safe timestamp.
    }
    return new Date().toISOString();
  }

  private normalizeModuleRole(role: string): ModuleRole | null {
    if (role === 'buyer' || role === 'supplier' || role === 'expert') return role;
    return null;
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

  private findCatalogAgent(idOrSlug: string): AgentRecord | null {
    const normalized = this.normalizeLegacyAgentKey(idOrSlug);
    const catalogAgent = AGENT_CATALOG.find(
      (agent) => agent.agentKey === normalized || agent.id === normalized || agent.slug === idOrSlug,
    );

    if (!catalogAgent) return null;

    const now = new Date();
    return {
      ...catalogAgent,
      createdAt: now,
      updatedAt: now,
    };
  }

  private async findAgent(idOrSlug: string) {
    const normalized = this.normalizeLegacyAgentKey(idOrSlug);
    const agent = await this.agentsCollection().findOne({
      $or: [{ id: normalized }, { agentKey: normalized }, { slug: idOrSlug }],
    });
    if (!agent) return null;

    try {
      const override = await this.agentStatusSettingsCollection().findOne({ agentKey: agent.agentKey });
      return this.applyAgentStatusOverride(agent, override);
    } catch {
      return agent;
    }
  }

  private async applyAgentStatusOverrides(agents: AgentRecord[]) {
    if (!agents.length) return agents;

    try {
      const overrides = await this.agentStatusSettingsCollection()
        .find({ agentKey: { $in: agents.map((agent) => agent.agentKey) } })
        .toArray();
      const overridesByAgentKey = new Map(overrides.map((override) => [override.agentKey, override]));

      return agents.map((agent) => this.applyAgentStatusOverride(agent, overridesByAgentKey.get(agent.agentKey)));
    } catch {
      return agents;
    }
  }

  private applyAgentStatusOverride(agent: AgentRecord, override?: AgentStatusOverrideRecord | null): AgentRecord {
    if (!override) return agent;

    return {
      ...agent,
      status: override.status,
      isActive: override.isActive,
      visibleToBuyer: override.visibleToBuyer,
      updatedAt: override.updatedAt ?? agent.updatedAt,
    };
  }

  private agentsCollection() {
    return this.databaseService.collection<AgentRecord>('agents');
  }

  private agentStatusSettingsCollection() {
    return this.databaseService.collection<AgentStatusOverrideRecord>('agentStatusSettings');
  }

  private executionsCollection() {
    return this.databaseService.collection<AgentExecutionRecord>('agentExecutions');
  }

  private feedbackCollection() {
    return this.databaseService.collection<AgentFeedbackRecord>('agentFeedback');
  }

  private userPdfBrandingSettingsCollection() {
    return this.databaseService.collection<UserPdfBrandingSettingsRecord>('userPdfBrandingSettings');
  }

  private agentPdfSettingsCollection() {
    return this.databaseService.collection<AgentPdfSettingsRecord>('agentPdfSettings');
  }

  private moduleActivationSettingsCollection() {
    return this.databaseService.collection<ModuleActivationSettingsRecord>('moduleActivationSettings');
  }
}
