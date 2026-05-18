import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersController } from './users.controller';
import { UsersRepository } from './persistence/users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [
    DatabaseModule,
    NotificationsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-buyernodus-secret',
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, AuthenticatedGuard],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
