import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { AgentsService } from './agents.service';

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
    @CurrentUser() user: { sub: string } | undefined,
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
}
