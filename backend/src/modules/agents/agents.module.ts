import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-supplynexu-secret',
    }),
  ],
  controllers: [AgentsController],
  providers: [AgentsService, AuthenticatedGuard],
  exports: [AgentsService],
})
export class AgentsModule {}
