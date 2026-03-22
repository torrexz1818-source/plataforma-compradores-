import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

type AuthenticatedIdentity = {
  sub: string;
  role: string;
};

type RequestWithAuth = Request & {
  user?: AuthenticatedIdentity;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedIdentity | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    return request.user;
  },
);
