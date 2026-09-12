import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { AuditService } from '@/common/audit/audit.service';
import type { PrismaService } from '@/common/prisma/prisma.service';

import { AuthService } from './auth.service';
import type { SessionService } from './session.service';

const context = { ip: null, userAgent: null };
const identity = { subject: 'google-user', email: 'owner@gmail.com', fullName: 'Owner Name' };

function setup(userBySubject: unknown = null, userByEmail: unknown = null) {
  const created = { id: 'new-user', companyId: null, isActive: true, lockedUntil: null, company: null };
  const findUnique = ({ where }: { where: { googleSubject?: string; email?: string } }): Promise<unknown> =>
    Promise.resolve(where.googleSubject ? userBySubject : userByEmail);
  const prisma = {
    user: {
      findUnique: vi.fn().mockImplementation(findUnique),
      update: vi.fn().mockResolvedValue(created),
      create: vi.fn().mockResolvedValue(created),
    },
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

describe('Google identity', () => {
  it('looks up by the immutable subject first', async () => {
    const { service, prisma } = setup();
    await service.googleAuth(identity, context);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { googleSubject: identity.subject },
      include: { company: true },
    });
  });

  it.each([
    { isActive: false, lockedUntil: null },
    { isActive: true, lockedUntil: new Date('2999-01-01') },
  ])('does not bypass disabled or locked accounts', async (state) => {
    const { service, sessions } = setup({ id: 'user', companyId: null, company: null, ...state });
    await expect(service.googleAuth(identity, context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.issue).not.toHaveBeenCalled();
  });

  it('links an existing password account found by verified email instead of duplicating it', async () => {
    const existing = {
      id: 'existing-password-user',
      companyId: 'company-1',
      isActive: true,
      lockedUntil: null,
      company: null,
    };
    const { service, prisma, sessions } = setup(null, existing);
    await service.googleAuth(identity, context);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: existing.id },
        data: { googleSubject: identity.subject },
      }),
    );
    expect(sessions.issue).toHaveBeenCalled();
  });

  it('creates a bare, company-less identity when nothing matches', async () => {
    const { service, prisma, sessions } = setup(null, null);
    await service.googleAuth(identity, context);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: null, googleSubject: identity.subject }) as unknown,
      }),
    );
    expect(sessions.issue).toHaveBeenCalled();
  });
});
