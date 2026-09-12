import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { AccessTokenPayload } from '../types/authenticated-user';

/// The raw token payload, companyId included even when it is null. Only for
/// the small set of routes marked `@AllowNoCompany()`: listing a person's
/// companies, creating the first one, switching between them. Everywhere else
/// use `@CurrentUser()`, which guarantees a company and matches what the rest
/// of the codebase already expects.
export const CurrentIdentity = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AccessTokenPayload }>();

    if (!request.user) {
      throw new Error('CurrentIdentity used on a route that JwtAuthGuard does not protect.');
    }

    return request.user;
  },
);
