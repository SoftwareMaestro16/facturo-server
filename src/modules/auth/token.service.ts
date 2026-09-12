import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { AccessTokenPayload } from '@/common/types/authenticated-user';
import { TypedConfigService } from '@/config/typed-config.service';

import { durationToMilliseconds, durationToSeconds } from './model/duration';

/// A refresh token carries only a session id. Everything else about the session
/// is read from the database, so revoking a row revokes the token.
export interface RefreshPayload {
  sid: string;
  /// Random per issue, so two tokens for the same session are never identical
  /// and the stored hash always changes on rotation.
  jti: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: TypedConfigService,
  ) {}

  signAccess(user: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(user, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: durationToSeconds(this.config.get('JWT_ACCESS_TTL')),
    });
  }

  signRefresh(sessionId: string): Promise<string> {
    const payload: RefreshPayload = { sid: sessionId, jti: randomBytes(16).toString('hex') };

    return this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: durationToSeconds(this.config.get('JWT_REFRESH_TTL')),
    });
  }

  /// Returns undefined rather than throwing: an expired or forged refresh token
  /// is ordinary traffic on this endpoint, not an exceptional condition.
  async verifyRefresh(token: string): Promise<RefreshPayload | undefined> {
    try {
      return await this.jwt.verifyAsync<RefreshPayload>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      return undefined;
    }
  }

  /// What goes in the sessions table. A stolen copy of that table is useless: a
  /// hash cannot be replayed as a token.
  hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  get accessCookieMaxAge(): number {
    return durationToMilliseconds(this.config.get('JWT_ACCESS_TTL'));
  }

  get refreshCookieMaxAge(): number {
    return durationToMilliseconds(this.config.get('JWT_REFRESH_TTL'));
  }

  refreshExpiryFrom(now: Date): Date {
    return new Date(now.getTime() + this.refreshCookieMaxAge);
  }
}
