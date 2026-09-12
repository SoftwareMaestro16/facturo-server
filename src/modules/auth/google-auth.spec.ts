import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { AuditService } from '@/common/audit/audit.service';
import type { PrismaService } from '@/common/prisma/prisma.service';

import { AuthService } from './auth.service';
import type { SessionService } from './session.service';

const context = { ip: null, userAgent: null };
const identity = { subject: 'google-user', email: 'owner@gmail.com', fullName: 'Owner Name' };
function setup(user: unknown = null) {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(user), update: vi.fn(), create: vi.fn() },
    company: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  const sessions = { issue: vi.fn().mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }) };
  const audit = { record: vi.fn() };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    sessions as unknown as SessionService,
    audit as unknown as AuditService,
  );
  return { service, prisma, sessions };
}

describe('Google accounts', () => {
  it('looks up the immutable subject and never links an email implicitly', async () => {
    const { service, prisma, sessions } = setup();
    await expect(service.googleLogin(identity, context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).toHaveBeenCalledExactlyOnceWith({
      where: { googleSubject: identity.subject },
      include: { company: true },
    });
    expect(sessions.issue).not.toHaveBeenCalled();
  });
  it.each([
    { isActive: false, lockedUntil: null },
    { isActive: true, lockedUntil: new Date('2999-01-01') },
  ])('does not bypass disabled or locked accounts', async (state) => {
    const { service, sessions } = setup({ id: 'user', ...state });
    await expect(service.googleLogin(identity, context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.issue).not.toHaveBeenCalled();
  });
  it('refuses registration over an existing password account', async () => {
    const { service, prisma, sessions } = setup({ id: 'existing-password-user' });
    await expect(
      service.googleRegister(
        { credential: 'verified', companyName: 'Company', idno: '1234567890123' },
        identity,
        context,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(sessions.issue).not.toHaveBeenCalled();
  });
});
