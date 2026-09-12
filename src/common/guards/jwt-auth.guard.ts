import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { TypedConfigService } from '@/config/typed-config.service';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user';

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

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = readAccessToken(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      request.user = await this.jwt.verifyAsync<AuthenticatedUser>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
    } catch {
      // Expiry and tampering are indistinguishable to the caller on purpose.
      throw new UnauthorizedException();
    }

    return true;
  }
}

function readAccessToken(request: Request): string | undefined {
  const fromCookie: unknown = (request.cookies as Record<string, unknown> | undefined)?.access_token;

  return typeof fromCookie === 'string' ? fromCookie : undefined;
}
