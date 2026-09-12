import { Injectable, Logger } from '@nestjs/common';
import type { AuditEventType, Prisma } from '@prisma/client';

import { PrismaService } from '@/common/prisma/prisma.service';

export interface AuditEntry {
  type: AuditEventType;
  companyId?: string | null;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Prisma.InputJsonValue;
}

/// Security events: logins, lockouts, password changes, session rotation,
/// document sends, payments.
///
/// Writes are fire-and-forget on purpose. If the audit table is full, slow or
/// locked, the customer still has to be able to log in and send an invoice. A
/// failed audit write is a problem for us, not a reason to fail their request.
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  record(entry: AuditEntry): void {
    void this.prisma.auditEvent
      .create({
        data: {
          type: entry.type,
          companyId: entry.companyId ?? null,
          userId: entry.userId ?? null,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
          meta: entry.meta,
        },
      })
      .catch((error: unknown) => {
        this.logger.error(`Failed to record ${entry.type}`, error instanceof Error ? error.stack : '');
      });
  }
}
