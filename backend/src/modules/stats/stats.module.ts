import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReportsController } from './reports.controller';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  imports: [DatabaseModule, AuthModule, NotificationsModule],
  controllers: [StatsController, ReportsController],
  providers: [StatsService],
})
export class StatsModule {}
