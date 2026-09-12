import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import { hash, verify } from 'argon2';

import { AuditService } from '@/common/audit/audit.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { AccessTokenPayload } from '@/common/types/authenticated-user';
import { normalizePhone } from '@/common/utils/phone';
import type { RequestContext } from '@/common/utils/request-context';

import type { ChangePasswordDto, LoginDto, RegisterDto, SessionResponse } from './dto';
import type { GoogleIdentity } from './google.service';
import { isLocked, registerFailure, registerSuccess } from './model/lockout';
import { validatePassword } from './model/password-policy';
import { type IssuedTokens, SessionService } from './session.service';

export interface AuthResult {
  tokens: IssuedTokens;
  session: SessionResponse;
}

interface UserWithCompany {
  id: string;
  companyId: string | null;
  email: string;
  fullName: string;
  role: UserRole;
  passwordHash: string | null;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  company: { name: string; locale: string; vatCode: string | null } | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto, context: RequestContext): Promise<AuthResult> {
    this.assertPasswordAllowed(dto.password, { phone: dto.phone });

    const email = normalizeEmail(dto.email);
    const [existingUser, existingCompany] = await Promise.all([
      this.prisma.user.findUnique({ where: { email }, select: { id: true } }),
      this.prisma.company.findUnique({ where: { idno: dto.idno }, select: { id: true } }),
    ]);

    if (existingUser) {
      throw new ConflictException({ code: 'email_taken', message: 'Email is already registered' });
    }

    if (existingCompany) {
      throw new ConflictException({ code: 'company_exists', message: 'This IDNO is already registered' });
    }

    const user = await this.createCompanyWithOwner(dto, email);

    this.audit.record({ type: 'REGISTER', userId: user.id, companyId: user.companyId, ...context });

    return {
      tokens: await this.sessions.issue(user, context),
      session: toSessionResponse(user),
    };
  }

  async login(dto: LoginDto, context: RequestContext): Promise<AuthResult> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email }, include: { company: true } });

    // One response for an unknown address, a wrong password and a locked
    // account. Anything else lets someone learn who has an account here.
    if (!user || !user.isActive || isLocked(user) || user.passwordHash === null) {
      this.audit.record({ type: 'LOGIN_FAILURE', userId: user?.id ?? null, ...context, meta: { email } });
      throw invalidCredentials();
    }

    if (!(await verify(user.passwordHash, dto.password))) {
      await this.registerFailedAttempt(user.id, user, context);
      throw invalidCredentials();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { ...registerSuccess(), lastLoginAt: new Date() },
    });

    this.audit.record({ type: 'LOGIN_SUCCESS', userId: user.id, companyId: user.companyId, ...context });

    return {
      tokens: await this.sessions.issue(user, context),
      session: toSessionResponse(user),
    };
  }

  /// One endpoint for both login and registration: Google already tells us
  /// whether this person exists. A brand-new identity gets no company yet —
  /// JwtAuthGuard blocks everything except the routes that create or join one.
  async googleAuth(identity: GoogleIdentity, context: RequestContext): Promise<AuthResult> {
    const existing = await this.findGoogleUser(identity);
    const isNewIdentity = existing === undefined;
    const user = existing ?? (await this.createGoogleUser(identity));

    if (!user.isActive || isLocked(user)) {
      throw invalidCredentials();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { ...registerSuccess(), lastLoginAt: new Date() },
    });

    this.audit.record({
      type: isNewIdentity ? 'REGISTER' : 'LOGIN_SUCCESS',
      userId: user.id,
      companyId: user.companyId,
      ...context,
    });

    return {
      tokens: await this.sessions.issue(user, context),
      session: toSessionResponse(user),
    };
  }

  async changePassword(
    current: AccessTokenPayload,
    dto: ChangePasswordDto,
    context: RequestContext,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: current.userId } });

    if (user.passwordHash === null) {
      throw new BadRequestException({
        code: 'no_password_set',
        message: 'This account signs in with Google and has no password to change',
      });
    }

    if (!(await verify(user.passwordHash, dto.currentPassword))) {
      throw invalidCredentials();
    }

    this.assertPasswordAllowed(dto.newPassword, {
      phone: user.phone,
      matchesCurrent: await verify(user.passwordHash, dto.newPassword),
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(dto.newPassword) },
    });

    // Every device signs in again. A password is changed because it may be
    // known to someone else, and a live session would survive the change.
    await this.sessions.revokeAllForUser(user.id);

    this.audit.record({
      type: 'PASSWORD_CHANGED',
      userId: user.id,
      companyId: user.companyId,
      ...context,
    });
  }

  async describe(current: AccessTokenPayload): Promise<SessionResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: current.userId },
      include: { company: true },
    });

    return toSessionResponse(user);
  }

  private async findGoogleUser(identity: GoogleIdentity): Promise<UserWithCompany | undefined> {
    const bySubject = await this.prisma.user.findUnique({
      where: { googleSubject: identity.subject },
      include: { company: true },
    });

    if (bySubject) {
      return bySubject;
    }

    const byEmail = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(identity.email) },
      include: { company: true },
    });

    if (!byEmail) {
      return undefined;
    }

    // Google already verified this email, so this is the same person proving
    // ownership a second way — link the accounts rather than error or duplicate.
    return this.prisma.user.update({
      where: { id: byEmail.id },
      data: { googleSubject: identity.subject },
      include: { company: true },
    });
  }

  private createGoogleUser(identity: GoogleIdentity): Promise<UserWithCompany> {
    return this.prisma.user.create({
      data: {
        email: normalizeEmail(identity.email),
        googleSubject: identity.subject,
        fullName: identity.fullName,
        passwordHash: null,
      },
      include: { company: true },
    });
  }

  private assertPasswordAllowed(
    candidate: string,
    context: { phone?: string | null; matchesCurrent?: boolean },
  ): void {
    const violations = validatePassword(candidate, {
      phone: context.phone ?? undefined,
      matchesCurrent: context.matchesCurrent,
    });

    if (violations.length > 0) {
      // The first violation is the one the interface points at; the rest are
      // there so a client can show them all if it wants to.
      throw new BadRequestException({ code: violations[0], message: violations.join(', ') });
    }
  }

  private async registerFailedAttempt(
    userId: string,
    state: { failedLoginAttempts: number; lockedUntil: Date | null; companyId: string | null },
    context: RequestContext,
  ): Promise<void> {
    const next = registerFailure(state);

    await this.prisma.user.update({ where: { id: userId }, data: next });

    this.audit.record({
      type: next.lockedUntil !== state.lockedUntil ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILURE',
      userId,
      companyId: state.companyId,
      ...context,
    });
  }

  private async createCompanyWithOwner(dto: RegisterDto, email: string): Promise<UserWithCompany> {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.companyName,
          idno: dto.idno,
          vatCode: dto.vatCode ?? null,
          isVatPayer: Boolean(dto.vatCode),
          locale: dto.locale ?? 'ro',
          // A default series so the first invoice has a number without the
          // customer having to visit settings first.
          numberSeries: { create: { series: 'FAC', isDefault: true } },
        },
      });

      return tx.user.create({
        data: {
          email,
          phone: dto.phone ? normalizePhone(dto.phone) : null,
          fullName: dto.fullName,
          passwordHash: await hash(dto.password),
          role: 'OWNER',
          companyId: company.id,
          memberships: { create: { companyId: company.id, role: 'OWNER' } },
        },
        include: { company: true },
      });
    });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({ code: 'invalid_credentials', message: 'Invalid credentials' });
}

function toSessionResponse(user: {
  id: string;
  companyId: string | null;
  email: string;
  fullName: string;
  role: SessionResponse['role'];
  company: { name: string; locale: string; vatCode: string | null } | null;
}): SessionResponse {
  return {
    userId: user.id,
    companyId: user.companyId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    companyName: user.company?.name ?? null,
    locale: user.company?.locale ?? null,
    vatCode: user.company?.vatCode ?? null,
  };
}
