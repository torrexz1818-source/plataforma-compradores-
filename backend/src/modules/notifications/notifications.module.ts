import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-supplyconnect-secret',
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, AuthenticatedGuard],
  exports: [NotificationsService],
})
export class NotificationsModule {}
