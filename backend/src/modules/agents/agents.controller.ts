import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { AgentsService, AgentStatus } from './agents.service';

@Controller('agents')
@UseGuards(AuthenticatedGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  async listAgents(
    @Query('category') category: string | undefined,
    @Query('automationType') automationType: string | undefined,
    @CurrentUser() user: { sub: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    return {
      items: await this.agentsService.listAgents({ category, automationType }),
    };
  }

  @Get('executions/mine')
  async getMyExecutions(@CurrentUser() user: { sub: string } | undefined) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    return {
      items: await this.agentsService.getUserExecutions(user.sub),
    };
  }

  @Get('pdf-options')
  async getPdfOptions(
    @Query('agentKey') agentKey: string | undefined,
    @CurrentUser() user: { sub: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    if (!agentKey?.trim()) {
      throw new BadRequestException('El agente es obligatorio');
    }

    return this.agentsService.getPdfOptionsForUser(user.sub, agentKey);
  }

  @Post('pdf-options/validate')
  async validatePdfMode(
    @Body() body: { agentKey?: string; pdfMode?: 'standard_branded' | 'white_label' | 'custom_brand' },
    @CurrentUser() user: { sub: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    if (!body.agentKey?.trim() || !body.pdfMode) {
      throw new BadRequestException('El agente y formato PDF son obligatorios');
    }

    return this.agentsService.assertPdfModeAllowed(user.sub, body.agentKey, body.pdfMode);
  }

  @Get(':id')
  async getAgentDetail(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    return this.agentsService.getAgentDetail(id);
  }

  @Post('run')
  async runAgent(
    @Body() body: { agentId?: string; inputData?: Record<string, unknown> },
    @CurrentUser() user: { sub: string; role: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    if (!body.agentId?.trim()) {
      throw new BadRequestException('El agente es obligatorio');
    }

    return this.agentsService.runAgent({
      agentId: body.agentId,
      userId: user.sub,
      userRole: user.role,
      inputData: body.inputData ?? {},
    });
  }

  @Post('usage')
  async recordUsage(
    @Body() body: {
      agentId?: string;
      operationName?: string;
      model?: string;
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      costAmount?: number;
      outputData?: Record<string, unknown>;
      latencyMs?: number;
      pdfGenerated?: boolean;
    },
    @CurrentUser() user: { sub: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    if (!body.agentId?.trim()) {
      throw new BadRequestException('El agente es obligatorio');
    }

    return this.agentsService.recordExternalUsage({
      agentId: body.agentId,
      userId: user.sub,
      operationName: body.operationName,
      model: body.model,
      inputTokens: body.inputTokens,
      outputTokens: body.outputTokens,
      totalTokens: body.totalTokens,
      costAmount: body.costAmount,
      outputData: body.outputData,
      latencyMs: body.latencyMs,
      pdfGenerated: body.pdfGenerated,
    });
  }

  @Post('feedback')
  async submitFeedback(
    @Body()
    body: {
      agentRunId?: string;
      stars?: number;
      feedbackType?: string;
      comment?: string;
      correctedVersion?: string;
      improvementSuggestion?: string;
      errorCategories?: string[];
    },
    @CurrentUser() user: { sub: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    if (!body.agentRunId?.trim()) {
      throw new BadRequestException('La ejecucion es obligatoria');
    }

    return this.agentsService.submitFeedback({
      agentRunId: body.agentRunId,
      userId: user.sub,
      stars: body.stars ?? 5,
      feedbackType: body.feedbackType ?? 'me_sirvio',
      comment: body.comment,
      correctedVersion: body.correctedVersion,
      improvementSuggestion: body.improvementSuggestion,
      errorCategories: body.errorCategories,
    });
  }

  @Post('activate')
  async activateAgent(
    @Body() body: { agentId?: string },
    @CurrentUser() user: { sub: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    if (!body.agentId?.trim()) {
      throw new BadRequestException('El agente es obligatorio');
    }

    return this.agentsService.activateAgent(body.agentId);
  }

  @Patch(':agentKey/status')
  async updateAgentStatus(
    @Param('agentKey') agentKey: string,
    @Body() body: { status?: AgentStatus },
    @CurrentUser() user: { sub: string; role: string } | undefined,
  ) {
    if (!user?.sub || user.role !== 'admin') {
      throw new ForbiddenException('Administrator permissions required');
    }

    if (!body.status) {
      throw new BadRequestException('El estado es obligatorio');
    }

    return this.agentsService.updateAgentStatus(agentKey, body.status);
  }
}
