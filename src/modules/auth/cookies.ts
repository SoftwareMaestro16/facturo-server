import type { CookieOptions, Response, Request } from 'express';

import type { TypedConfigService } from '@/config/typed-config.service';

import type { IssuedTokens } from './session.service';
import type { TokenService } from './token.service';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

/// The refresh cookie is scoped to the auth routes. It is the long-lived
/// credential, and there is no reason for it to travel with every request to
/// every endpoint.
const REFRESH_PATH = '/api/auth';

function baseOptions(config: TypedConfigService): CookieOptions {
  return {
    httpOnly: true,
    // Lax rather than Strict: a customer following a link from an email into
    // the application should still arrive signed in, and Lax already blocks the
    // cross-site POST that CSRF needs.
    sameSite: 'lax',
    secure: config.isProduction,
    domain: config.get('COOKIE_DOMAIN'),
  };
}

export function setAuthCookies(
  response: Response,
  tokens: IssuedTokens,
  config: TypedConfigService,
  tokenService: TokenService,
): void {
  const options = baseOptions(config);

  response.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...options,
    path: '/',
    maxAge: tokenService.accessCookieMaxAge,
  });

  response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...options,
    path: REFRESH_PATH,
    maxAge: tokenService.refreshCookieMaxAge,
  });
}

export function clearAuthCookies(response: Response, config: TypedConfigService): void {
  const options = baseOptions(config);

  response.clearCookie(ACCESS_COOKIE, { ...options, path: '/' });
  response.clearCookie(REFRESH_COOKIE, { ...options, path: REFRESH_PATH });
}

export function readRefreshCookie(request: Request): string | undefined {
  const value: unknown = (request.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];

  return typeof value === 'string' ? value : undefined;
}
