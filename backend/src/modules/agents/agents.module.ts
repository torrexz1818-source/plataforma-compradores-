import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { DatabaseModule } from '../database/database.module';
import { UsersModule } from '../users/users.module';
import { AiHealthController } from './ai-health.controller';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-buyernodus-secret',
    }),
  ],
  controllers: [AgentsController, AiHealthController],
  providers: [AgentsService, AuthenticatedGuard],
  exports: [AgentsService],
})
export class AgentsModule {}
