import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminGuard } from '../../common/auth/admin.guard';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { PostsModule } from '../posts/posts.module';
import { UploadsModule } from '../uploads/uploads.module';
import { UsersModule } from '../users/users.module';
import { AgentsModule } from '../agents/agents.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    UsersModule,
    PostsModule,
    UploadsModule,
    AgentsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-buyernodus-secret',
    }),
  ],
  controllers: [AdminController],
  providers: [AuthenticatedGuard, AdminGuard],
})
export class AdminModule {}
