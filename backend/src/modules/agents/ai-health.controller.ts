import { Controller, Get, Header, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AgentsService } from './agents.service';

@Controller()
export class AiHealthController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get(['ai/health', 'api/ai/health'])
  @Header('Cache-Control', 'no-store')
  async getHealth(@Req() request: Request) {
    return this.agentsService.getAiHealth({
      traceId: this.getTraceId(request),
      country: this.getCountry(request),
    });
  }

  @Get(['ai/health/deep', 'api/ai/health/deep'])
  @Header('Cache-Control', 'no-store')
  async getDeepHealth(@Req() request: Request) {
    return this.agentsService.getAiDeepHealth({
      traceId: this.getTraceId(request),
      country: this.getCountry(request),
    });
  }

  private getTraceId(request: Request) {
    const headerValue = request.headers['x-trace-id'] ?? request.headers['x-request-id'];
    return Array.isArray(headerValue) ? headerValue[0] : headerValue;
  }

  private getCountry(request: Request) {
    const headerValue =
      request.headers['cf-ipcountry'] ??
      request.headers['x-vercel-ip-country'] ??
      request.headers['cloudfront-viewer-country'];
    return Array.isArray(headerValue) ? headerValue[0] : headerValue;
  }
}
