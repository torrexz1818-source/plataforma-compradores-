import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-supplyconnect-secret',
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, AuthenticatedGuard],
  exports: [UsersService],
})
export class UsersModule {}
