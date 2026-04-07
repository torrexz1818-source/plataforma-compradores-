import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @UseGuards(AuthenticatedGuard)
  @Get()
  getStats() {
    return this.statsService.getStats();
  }
}
