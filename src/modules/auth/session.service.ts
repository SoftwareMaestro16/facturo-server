import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

import { AuditService } from '@/common/audit/audit.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { RequestContext } from '@/common/utils/request-context';

import { TokenService } from './token.service';

export interface SessionUser {
  id: string;
  /// Null for an identity that has not created or joined a company yet.
  companyId: string | null;
  email: string;
  role: UserRole;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

/// Everything that creates, rotates or revokes a refresh session.
///
/// Split from AuthService because the rules here are about sessions rather than
/// about people: rotation, reuse detection, and revoking a whole chain when a
/// token turns up that should already be dead.
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async issue(user: SessionUser, context: RequestContext): Promise<IssuedTokens> {
    // The id is chosen here rather than by the database so the token can name
    // the session and the row can store the token's hash in a single insert.
    const sessionId = randomUUID();
    const refreshToken = await this.tokens.signRefresh(sessionId);

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash: this.tokens.hashToken(refreshToken),
        expiresAt: this.tokens.refreshExpiryFrom(new Date()),
        ip: context.ip,
        userAgent: context.userAgent,
      },
    });

    const accessToken = await this.tokens.signAccess({
      userId: user.id,
      companyId: user.companyId,
      email: user.email,
      role: user.role,
    });

    return { accessToken, refreshToken };
  }

  /// Rotates a refresh token. Returns undefined for anything that is not a live
  /// session, without saying which of the several reasons applied.
  async rotate(refreshToken: string, context: RequestContext): Promise<IssuedTokens | undefined> {
    const payload = await this.tokens.verifyRefresh(refreshToken);

    if (!payload) {
      return undefined;
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (!session || !session.user.isActive) {
      return undefined;
    }

    const stillCurrent = session.tokenHash === this.tokens.hashToken(refreshToken);

    // A token that no longer matches the stored hash is one we already rotated
    // away from. Its holder either kept a copy or stole one, and we cannot tell
    // which — so the whole chain dies and every device signs in again.
    if (!stillCurrent || session.revokedAt !== null) {
      await this.revokeAllForUser(session.userId);
      this.audit.record({
        type: 'SESSION_REVOKED',
        userId: session.userId,
        companyId: session.user.companyId,
        ip: context.ip,
        userAgent: context.userAgent,
        meta: { reason: 'refresh_token_reuse', sessionId: session.id },
      });

      return undefined;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      return undefined;
    }

    return this.replace(session.id, toSessionUser(session.user), context);
  }

  async revokeByToken(refreshToken: string): Promise<void> {
    const payload = await this.tokens.verifyRefresh(refreshToken);

    if (!payload) {
      return;
    }

    await this.prisma.session.updateMany({
      where: { id: payload.sid, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /// Used when a password changes: every device signs in again.
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async replace(
    previousId: string,
    user: SessionUser,
    context: RequestContext,
  ): Promise<IssuedTokens> {
    const issued = await this.issue(user, context);
    const payload = await this.tokens.verifyRefresh(issued.refreshToken);

    await this.prisma.session.update({
      where: { id: previousId },
      data: { revokedAt: new Date(), replacedById: payload?.sid ?? null },
    });

    this.audit.record({
      type: 'SESSION_ROTATED',
      userId: user.id,
      companyId: user.companyId,
      ip: context.ip,
      userAgent: context.userAgent,
      meta: { previousSessionId: previousId },
    });

    return issued;
  }
}

function toSessionUser(user: {
  id: string;
  companyId: string | null;
  email: string;
  role: UserRole;
}): SessionUser {
  return { id: user.id, companyId: user.companyId, email: user.email, role: user.role };
}
