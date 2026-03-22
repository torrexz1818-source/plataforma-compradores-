import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { UserRole } from '../../modules/users/domain/user-role.enum';

type AuthenticatedIdentity = {
  sub: string;
  role: string;
};

type RequestWithAuth = Request & {
  user?: AuthenticatedIdentity;
};

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();

    if (request.user?.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Administrator permissions required');
    }

    return true;
  }
}
