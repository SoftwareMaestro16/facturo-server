import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';

import { TypedConfigService } from '@/config/typed-config.service';

export interface GoogleIdentity {
  subject: string;
  email: string;
  fullName: string;
}

/// Codes from the popup flow are bound to this pseudo redirect, not to a URL.
const POPUP_REDIRECT = 'postmessage';

@Injectable()
export class GoogleService {
  constructor(private readonly config: TypedConfigService) {}

  /// Turns the popup's one-time code into a verified identity. The ID token
  /// arrives straight from Google's token endpoint, and is still checked for
  /// our audience, a verified email and a subject before anything trusts it.
  /// Google refuses a code presented twice, so a captured code cannot be
  /// replayed.
  async exchangeCode(code: string): Promise<GoogleIdentity> {
    const clientId = this.required('GOOGLE_CLIENT_ID');
    const client = new OAuth2Client({
      clientId,
      clientSecret: this.required('GOOGLE_CLIENT_SECRET'),
      redirectUri: POPUP_REDIRECT,
    });

    try {
      const { tokens } = await client.getToken(code);
      if (!tokens.id_token) throw invalidGoogleCredential();
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
      return toIdentity(ticket.getPayload());
    } catch {
      // Never expose Google's response, the code or the token.
      throw invalidGoogleCredential();
    }
  }

  private required(key: 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET'): string {
    const value = this.config.get(key);
    if (!value) {
      throw new ServiceUnavailableException({
        code: 'google_unavailable',
        message: 'Google login is not configured',
      });
    }
    return value;
  }
}

function toIdentity(payload: TokenPayload | undefined): GoogleIdentity {
  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw invalidGoogleCredential();
  }
  return {
    subject: payload.sub,
    email: payload.email.trim().toLowerCase(),
    fullName: (payload.name || payload.email).slice(0, 120),
  };
}

function invalidGoogleCredential(): UnauthorizedException {
  return new UnauthorizedException({ code: 'google_invalid', message: 'Invalid Google credential' });
}
