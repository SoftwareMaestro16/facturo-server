import { createParamDecorator, type ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';

import type { AccessTokenPayload, AuthenticatedUser } from '../types/authenticated-user';

/// Guarantees a companyId. `JwtAuthGuard` already refuses to reach a handler
/// with a null companyId unless it is marked `@AllowNoCompany()`, so this
/// assertion is defensive, not the primary line of defence — but a handler
/// that reaches here with no company is a bug worth a clear error rather than
/// a silent `null` flowing into a Prisma `where: { companyId }` clause.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AccessTokenPayload }>();

    if (!request.user) {
      throw new Error('CurrentUser used on a route that JwtAuthGuard does not protect.');
    }

    if (request.user.companyId === null) {
      throw new ForbiddenException({ code: 'company_required', message: 'Add a company first' });
    }

    return { ...request.user, companyId: request.user.companyId };
  },
);
