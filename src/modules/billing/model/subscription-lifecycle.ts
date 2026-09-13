import { hasQuotaLeft, type PlanCode } from './plans';

/// Declared here rather than imported from the generated Prisma client, so the
/// rules stay testable without a database — the values mirror the
/// SubscriptionStatus enum in the schema.
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';

export interface SubscriptionRecord {
  plan: PlanCode;
  status: SubscriptionStatus;
  invoicesUsed: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

/// What a subscription's state should be *right now*, without touching the
/// database. A period is a calendar month.
///
/// FREE needs nobody to pay it forward, so a lapsed FREE period just rolls to
/// a fresh one with the usage counter back at zero. A paid plan whose period
/// ended without a renewing payment goes PAST_DUE instead: the point is that
/// it stops counting up, not what number it stopped at, so the usage here is
/// left alone rather than reset.
export function resolveSubscriptionState(record: SubscriptionRecord, now: Date): SubscriptionRecord {
  if (now < record.currentPeriodEnd) {
    return record;
  }

  if (record.plan === 'FREE') {
    return {
      ...record,
      status: 'ACTIVE',
      invoicesUsed: 0,
      currentPeriodStart: now,
      currentPeriodEnd: addMonth(now),
    };
  }

  return record.status === 'CANCELLED' ? record : { ...record, status: 'PAST_DUE' };
}

/// The one question the invoice-issuing flow actually needs answered: can
/// this company sign one more document right now. A cancelled or past-due
/// subscription keeps its existing documents readable — see
/// docs/legal/risks-and-contacts.md and CLAUDE.md's billing section — it just
/// cannot create new ones.
export function canIssueInvoice(record: SubscriptionRecord): boolean {
  return record.status === 'ACTIVE' && hasQuotaLeft(record.plan, record.invoicesUsed);
}

export function addMonth(date: Date): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + 1);

  return next;
}
