import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { EducationalContentController } from './educational-content.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { PostsController } from './posts.controller';
import { PublicationsController } from './publications.controller';
import { PostsService } from './posts.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-supplyconnect-secret',
    }),
  ],
  controllers: [PostsController, PublicationsController, EducationalContentController],
  providers: [PostsService, AuthenticatedGuard],
  exports: [PostsService],
})
export class PostsModule {}
