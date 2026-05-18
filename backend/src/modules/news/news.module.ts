import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminGuard } from '../../common/auth/admin.guard';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { UploadsModule } from '../uploads/uploads.module';
import { UsersModule } from '../users/users.module';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    UploadsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-buyernodus-secret',
    }),
  ],
  controllers: [NewsController],
  providers: [NewsService, AuthenticatedGuard, AdminGuard],
  exports: [NewsService],
})
export class NewsModule {}
