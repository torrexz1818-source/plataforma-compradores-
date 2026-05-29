import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Patch,
  Param,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { AgentsService, AgentStatus } from './agents.service';

const agentUploadMaxFileSize =
  Number.parseInt(process.env.AGENT_UPLOAD_MAX_FILE_SIZE_BYTES?.trim() || '', 10) || 50 * 1024 * 1024;

type UploadedAgentFile = {
  fieldname: string;
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
};

type RunAgentBody = {
  agentId?: string;
  inputData?: Record<string, unknown>;
  operation?: string;
  [key: string]: unknown;
};

@Controller('agents')
@UseGuards(AuthenticatedGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
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
  @Header('Cache-Control', 'no-store')
  async getMyExecutions(@CurrentUser() user: { sub: string } | undefined) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    return {
      items: await this.agentsService.getUserExecutions(user.sub),
    };
  }

  @Get('pdf-options')
  @Header('Cache-Control', 'no-store')
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

  @Get('module-activations/mine')
  @Header('Cache-Control', 'no-store')
  async getMyModuleActivations(
    @CurrentUser() user: { sub: string; role: string } | undefined,
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Authentication required');
    }

    return this.agentsService.getModuleActivationSettingsForUser(user.role);
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
  @Header('Cache-Control', 'no-store')
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
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: memoryStorage(),
      limits: {
        fileSize: agentUploadMaxFileSize,
      },
    }),
  )
  async runAgent(
    @Body() body: RunAgentBody,
    @UploadedFiles() files: UploadedAgentFile[] | undefined,
    @CurrentUser() user: { sub: string; role: string } | undefined,
    @Req() request: Request,
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
      inputData: this.getInputData(body),
      aiOperation: typeof body.operation === 'string' ? body.operation : undefined,
      formFields: body as Record<string, unknown>,
      files,
      requestMeta: {
        traceId: this.getTraceId(request),
        country: this.getCountry(request),
      },
    });
  }

  @Post('usage')
  @Header('Cache-Control', 'no-store')
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
  @Header('Cache-Control', 'no-store')
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
  @Header('Cache-Control', 'no-store')
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
  @Header('Cache-Control', 'no-store')
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

  private getTraceId(request: Request) {
    const headerValue = request.headers['x-trace-id'] ?? request.headers['x-request-id'];
    return Array.isArray(headerValue) ? headerValue[0] : headerValue;
  }

  private getInputData(body: RunAgentBody) {
    if (body.inputData && typeof body.inputData === 'object' && !Array.isArray(body.inputData)) {
      return body.inputData;
    }

    if (typeof body.inputData === 'string') {
      try {
        const parsed = JSON.parse(body.inputData) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return {};
      }
    }

    return {};
  }

  private getCountry(request: Request) {
    const headerValue =
      request.headers['cf-ipcountry'] ??
      request.headers['x-vercel-ip-country'] ??
      request.headers['cloudfront-viewer-country'];
    return Array.isArray(headerValue) ? headerValue[0] : headerValue;
  }
}
