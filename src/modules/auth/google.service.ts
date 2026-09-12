import { randomBytes } from 'node:crypto';

import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

import { TypedConfigService } from '@/config/typed-config.service';

export interface GoogleIdentity {
  subject: string;
  email: string;
  fullName: string;
}

@Injectable()
export class GoogleService {
  private readonly client = new OAuth2Client();

  constructor(private readonly config: TypedConfigService) {}

  challenge(): string {
    this.clientId();
    return randomBytes(32).toString('base64url');
  }

  async verify(credential: string, nonce: unknown): Promise<GoogleIdentity> {
    const audience = this.clientId();
    if (typeof nonce !== 'string' || nonce.length !== 43) throw invalidGoogleCredential();
    try {
      const ticket = await this.client.verifyIdToken({ idToken: credential, audience });
      const payload = ticket.getPayload();
      // The browser challenge binds this credential to the browser starting login.
      if (!payload?.sub || !payload.email || !payload.email_verified || payload.nonce !== nonce) {
        throw invalidGoogleCredential();
      }
      return {
        subject: payload.sub,
        email: payload.email.trim().toLowerCase(),
        fullName: (payload.name || payload.email).slice(0, 120),
      };
    } catch {
      // Never expose Google's response or the presented credential.
      throw invalidGoogleCredential();
    }
  }

  private clientId(): string {
    const value = this.config.get('GOOGLE_CLIENT_ID');
    if (!value) {
      throw new ServiceUnavailableException({
        code: 'google_unavailable',
        message: 'Google login is not configured',
      });
    }
    return value;
  }
}

function invalidGoogleCredential(): UnauthorizedException {
  return new UnauthorizedException({ code: 'google_invalid', message: 'Invalid Google credential' });
}
