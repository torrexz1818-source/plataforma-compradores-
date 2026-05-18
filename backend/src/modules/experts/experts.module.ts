import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { ExpertsController, ExpertsOauthController } from './experts.controller';
import { ExpertsService } from './experts.service';
import { GoogleCalendarService } from './google-calendar.service';

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    NotificationsModule,
    AuthModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-buyernodus-secret',
    }),
  ],
  controllers: [ExpertsController, ExpertsOauthController],
  providers: [ExpertsService, GoogleCalendarService, AuthenticatedGuard],
})
export class ExpertsModule {}
