import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { TypedConfigService } from '@/config/typed-config.service';

import { ALLOW_NO_COMPANY_KEY } from '../decorators/allow-no-company.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AccessTokenPayload } from '../types/authenticated-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: TypedConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AccessTokenPayload }>();
    const token = readAccessToken(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: AccessTokenPayload;

    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
    } catch {
      // Expiry and tampering are indistinguishable to the caller on purpose.
      throw new UnauthorizedException();
    }

    // A person who has not created or joined a company yet is blocked from
    // every route except the few that exist to get them one. This is what
    // lets @CurrentUser() promise a non-null companyId everywhere else.
    const allowNoCompany = this.reflector.getAllAndOverride<boolean>(ALLOW_NO_COMPANY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (payload.companyId === null && !allowNoCompany) {
      throw new ForbiddenException({ code: 'company_required', message: 'Add a company first' });
    }

    request.user = payload;

    return true;
  }
}

function readAccessToken(request: Request): string | undefined {
  const fromCookie: unknown = (request.cookies as Record<string, unknown> | undefined)?.access_token;

  return typeof fromCookie === 'string' ? fromCookie : undefined;
}
