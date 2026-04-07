import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { ConversationsController } from './conversations.controller';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [
    UsersModule,
    NotificationsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-supplyconnect-secret',
    }),
  ],
  controllers: [MessagesController, ConversationsController],
  providers: [MessagesService, AuthenticatedGuard],
  exports: [MessagesService],
})
export class MessagesModule {}
