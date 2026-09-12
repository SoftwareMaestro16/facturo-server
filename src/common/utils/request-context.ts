import type { Request } from 'express';

/// Where a request came from, for the audit trail.
///
/// The address is taken from Express, which already honours `trust proxy`. A
/// hand-rolled read of X-Forwarded-For would trust a header the caller controls.
export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

const USER_AGENT_MAX_LENGTH = 255;

export function readRequestContext(request: Request): RequestContext {
  const userAgent = request.get('user-agent');

  return {
    ip: request.ip ?? null,
    // A user agent is attacker-controlled and unbounded. Truncate before it
    // reaches the database.
    userAgent: userAgent ? userAgent.slice(0, USER_AGENT_MAX_LENGTH) : null,
  };
}
