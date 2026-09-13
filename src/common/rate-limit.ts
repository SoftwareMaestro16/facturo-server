import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

import type { TypedConfigService } from '@/config/typed-config.service';

/// Rate limiting lives in middleware rather than in a NestJS guard.
///
/// @nestjs/throttler has not shipped support for NestJS 12 — the same trap the
/// playbook records for @sentry/nestjs. Rather than force the install and hope,
/// the limiter is plain Express middleware, which has no framework coupling to
/// break on the next major.

export function generalLimiter(config: TypedConfigService): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.get('THROTTLE_TTL_SECONDS') * 1000,
    limit: config.get('THROTTLE_LIMIT'),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { statusCode: 429, code: 'too_many_requests', message: 'Too many requests' },
  });
}

/// The assistant costs money per call and is the endpoint a stolen session would
/// hammer. The per-company daily limit bounds the total; this bounds bursts.
export function aiLimiter(): RateLimitRequestHandler {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { statusCode: 429, code: 'too_many_requests', message: 'Too many assistant requests' },
  });
}

/// Login and registration get their own, much tighter budget: these are the
/// endpoints worth guessing against, and the general limit is far too generous
/// to slow a password attack down.
export function authLimiter(config: TypedConfigService): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.get('THROTTLE_TTL_SECONDS') * 1000,
    limit: config.get('AUTH_THROTTLE_LIMIT'),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { statusCode: 429, code: 'too_many_requests', message: 'Too many attempts' },
  });
}
