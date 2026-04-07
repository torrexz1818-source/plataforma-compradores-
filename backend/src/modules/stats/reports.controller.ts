import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { UserRole } from '../users/domain/user-role.enum';
import { StatsService } from './stats.service';

@Controller('reportes')
@UseGuards(AuthenticatedGuard)
export class ReportsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  getMonthlyReport(
    @Query('month') month: string | undefined,
    @CurrentUser() user: { sub: string; role: UserRole },
  ) {
    if (user.role === UserRole.ADMIN) {
      return this.statsService.getAdminMonthlyReport(month);
    }

    if (user.role !== UserRole.BUYER && user.role !== UserRole.SUPPLIER) {
      throw new BadRequestException('Solo compradores, proveedores o admin pueden ver reportes');
    }

    return this.statsService.getMonthlyReport(user.sub, user.role, month);
  }
}
