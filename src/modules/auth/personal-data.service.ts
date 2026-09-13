import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/common/prisma/prisma.service';

import type { PersonalDataExport } from './dto/personal-data.dto';

/// Caps keep the file readable and the query bounded; the newest entries are
/// the ones a person asking "who signed in as me" is looking for.
const SESSION_LIMIT = 200;
const EVENT_LIMIT = 500;

/// Right of access and portability for the person's own account. Scoped by
/// userId from the token, not by companyId: this is data about a person, and a
/// person may belong to several companies. Audit `meta` is left out on purpose —
/// a failed-login entry can carry an address someone else typed.
@Injectable()
export class PersonalDataService {
  constructor(private readonly prisma: PrismaService) {}

  async export(userId: string): Promise<PersonalDataExport> {
    const [user, events] = await Promise.all([this.loadUser(userId), this.loadEvents(userId)]);

    return toExport(user, events, new Date());
  }

  private loadUser(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        fullName: true,
        phone: true,
        googleSubject: true,
        createdAt: true,
        lastLoginAt: true,
        termsVersion: true,
        termsAcceptedAt: true,
        memberships: {
          orderBy: { createdAt: 'asc' },
          select: { role: true, createdAt: true, company: { select: { name: true, idno: true } } },
        },
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: SESSION_LIMIT,
          select: { createdAt: true, expiresAt: true, revokedAt: true, ip: true, userAgent: true },
        },
      },
    });
  }

  private loadEvents(userId: string) {
    return this.prisma.auditEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: EVENT_LIMIT,
      select: { type: true, createdAt: true, ip: true, userAgent: true },
    });
  }
}

type StoredUser = Awaited<ReturnType<PersonalDataService['loadUser']>>;
type StoredEvent = Awaited<ReturnType<PersonalDataService['loadEvents']>>[number];

const iso = (value: Date | null): string | null => value?.toISOString() ?? null;

function toExport(user: StoredUser, events: StoredEvent[], now: Date): PersonalDataExport {
  return {
    exportedAt: now.toISOString(),
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    signsInWithGoogle: user.googleSubject !== null,
    accountCreatedAt: user.createdAt.toISOString(),
    lastLoginAt: iso(user.lastLoginAt),
    termsVersion: user.termsVersion,
    termsAcceptedAt: iso(user.termsAcceptedAt),
    memberships: user.memberships.map((membership) => ({
      companyName: membership.company.name,
      companyIdno: membership.company.idno,
      role: membership.role,
      since: membership.createdAt.toISOString(),
    })),
    sessions: user.sessions.map((session) => ({
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: iso(session.revokedAt),
      ip: session.ip,
      userAgent: session.userAgent,
    })),
    securityEvents: events.map((event) => ({
      type: event.type,
      createdAt: event.createdAt.toISOString(),
      ip: event.ip,
      userAgent: event.userAgent,
    })),
  };
}
