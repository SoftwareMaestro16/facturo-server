import { UnauthorizedException } from '@nestjs/common';
import { LoginTicket, OAuth2Client, type TokenPayload, type VerifyIdTokenOptions } from 'google-auth-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TypedConfigService } from '@/config/typed-config.service';

import { GoogleService } from './google.service';

const nonce = 'n'.repeat(43);
const payload: TokenPayload = {
  sub: 'google-subject',
  email: 'Owner@gmail.com',
  email_verified: true,
  name: 'Company Owner',
  nonce,
  aud: 'test-client',
  iss: 'https://accounts.google.com',
  iat: 1,
  exp: 9999999999,
};
const config = { get: () => 'test-client' } as unknown as TypedConfigService;
// Select the Promise overload used by the service; the SDK also exposes callbacks.
const googleClient = OAuth2Client.prototype as unknown as {
  verifyIdToken: (options: VerifyIdTokenOptions) => Promise<LoginTicket>;
};

describe('Google identity verification', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the configured audience and returns identity only after verification', async () => {
    const verify = vi.spyOn(googleClient, 'verifyIdToken').mockResolvedValue(new LoginTicket('', payload));
    await expect(new GoogleService(config).verify('signed-token', nonce)).resolves.toEqual({
      subject: 'google-subject',
      email: 'owner@gmail.com',
      fullName: 'Company Owner',
    });
    expect(verify).toHaveBeenCalledWith({ idToken: 'signed-token', audience: 'test-client' });
  });

  it.each([undefined, '', 'wrong-browser'])(
    'rejects missing/invalid browser challenges (%s)',
    async (challenge) => {
      const verify = vi.spyOn(OAuth2Client.prototype, 'verifyIdToken');
      await expect(new GoogleService(config).verify('token', challenge)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(verify).not.toHaveBeenCalled();
    },
  );

  it.each([
    { ...payload, nonce: 'other' },
    { ...payload, email_verified: false },
    { ...payload, sub: '' },
  ])('rejects an unverified identity or mismatched nonce', async (claims) => {
    vi.spyOn(googleClient, 'verifyIdToken').mockResolvedValue(new LoginTicket('', claims));
    await expect(new GoogleService(config).verify('token', nonce)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('does not leak signature verification failures', async () => {
    vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockRejectedValue(new Error('private token details'));
    await expect(new GoogleService(config).verify('token', nonce)).rejects.toThrow(
      'Invalid Google credential',
    );
  });
});
