/// Pricing. One table, read by the quota check, the billing page and the
/// checkout, so a price can never disagree with itself.

/// Mirrors the PlanCode enum in the Prisma schema. Declared here so pricing can
/// be unit tested without generating a client.
export type PlanCode = 'FREE' | 'STARTER' | 'BUSINESS';

export interface Plan {
  code: PlanCode;
  /// Lei per month, VAT included.
  priceMdl: string;
  /// Outgoing documents per period. Null means unlimited.
  invoiceQuota: number | null;
  users: number | null;
}

/// The free tier exists to get a company's counterparties into the system
/// before the first bill. Ten documents is roughly one month for the smallest
/// customers and clearly not enough for the target ones.
export const PLANS: Readonly<Record<PlanCode, Plan>> = {
  FREE: { code: 'FREE', priceMdl: '0.00', invoiceQuota: 10, users: 1 },
  STARTER: { code: 'STARTER', priceMdl: '249.00', invoiceQuota: 100, users: 3 },
  BUSINESS: { code: 'BUSINESS', priceMdl: '599.00', invoiceQuota: null, users: null },
};

export function planFor(code: PlanCode): Plan {
  return PLANS[code];
}

export function hasQuotaLeft(plan: PlanCode, used: number): boolean {
  const quota = PLANS[plan].invoiceQuota;

  return quota === null || used < quota;
}
