import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { LoginTicket, OAuth2Client, type TokenPayload, type VerifyIdTokenOptions } from 'google-auth-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TypedConfigService } from '@/config/typed-config.service';

import { GoogleService } from './google.service';

const payload: TokenPayload = {
  sub: 'google-subject',
  email: 'Owner@gmail.com',
  email_verified: true,
  name: 'Company Owner',
  aud: 'test-client',
  iss: 'https://accounts.google.com',
  iat: 1,
  exp: 9999999999,
};

function configWith(values: Record<string, string | undefined>): TypedConfigService {
  return { get: (key: string) => values[key] } as unknown as TypedConfigService;
}

const config = configWith({ GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret' });

// Select the Promise overloads used by the service; the SDK also exposes callbacks.
const googleClient = OAuth2Client.prototype as unknown as {
  verifyIdToken: (options: VerifyIdTokenOptions) => Promise<LoginTicket>;
  getToken: (code: string) => Promise<{ tokens: { id_token?: string | null } }>;
};

describe('Google code exchange', () => {
  afterEach(() => vi.restoreAllMocks());

  it('exchanges the code and verifies the ID token for our audience', async () => {
    const getToken = vi.spyOn(googleClient, 'getToken').mockResolvedValue({ tokens: { id_token: 'signed' } });
    const verify = vi.spyOn(googleClient, 'verifyIdToken').mockResolvedValue(new LoginTicket('', payload));

    await expect(new GoogleService(config).exchangeCode('one-time-code')).resolves.toEqual({
      subject: 'google-subject',
      email: 'owner@gmail.com',
      fullName: 'Company Owner',
    });
    expect(getToken).toHaveBeenCalledWith('one-time-code');
    expect(verify).toHaveBeenCalledWith({ idToken: 'signed', audience: 'test-client' });
  });

  it('refuses when Google returns no ID token', async () => {
    vi.spyOn(googleClient, 'getToken').mockResolvedValue({ tokens: {} });
    const verify = vi.spyOn(googleClient, 'verifyIdToken');

    await expect(new GoogleService(config).exchangeCode('code')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(verify).not.toHaveBeenCalled();
  });

  it.each([
    { ...payload, email_verified: false },
    { ...payload, sub: '' },
    { ...payload, email: '' },
  ])('rejects an unverified or incomplete identity', async (claims) => {
    vi.spyOn(googleClient, 'getToken').mockResolvedValue({ tokens: { id_token: 'signed' } });
    vi.spyOn(googleClient, 'verifyIdToken').mockResolvedValue(new LoginTicket('', claims));

    await expect(new GoogleService(config).exchangeCode('code')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('does not leak exchange failures', async () => {
    vi.spyOn(googleClient, 'getToken').mockRejectedValue(new Error('invalid_grant: private details'));

    await expect(new GoogleService(config).exchangeCode('code')).rejects.toThrow('Invalid Google credential');
  });

  it('reports Google sign-in as unavailable without a client secret', async () => {
    const service = new GoogleService(configWith({ GOOGLE_CLIENT_ID: 'test-client' }));

    await expect(service.exchangeCode('code')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
