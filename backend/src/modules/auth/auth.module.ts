import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-supplyconnect-secret',
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailService],
  exports: [JwtModule],
})
export class AuthModule {}
