import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { DatabaseModule } from '../database/database.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-buyernodus-secret',
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, AuthenticatedGuard],
  exports: [NotificationsService],
})
export class NotificationsModule {}
