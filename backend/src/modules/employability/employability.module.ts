import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { EmployabilityController } from './employability.controller';
import { EmployabilityService } from './employability.service';

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    NotificationsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-buyernodus-secret',
    }),
  ],
  controllers: [EmployabilityController],
  providers: [EmployabilityService, AuthenticatedGuard],
  exports: [EmployabilityService],
})
export class EmployabilityModule {}
