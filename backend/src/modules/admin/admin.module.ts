import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminGuard } from '../../common/auth/admin.guard';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { PostsModule } from '../posts/posts.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    UsersModule,
    PostsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-supplyconnect-secret',
    }),
  ],
  controllers: [AdminController],
  providers: [AuthenticatedGuard, AdminGuard],
})
export class AdminModule {}
