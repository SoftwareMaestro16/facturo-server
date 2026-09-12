import { describe, expect, it } from 'vitest';

import { hasQuotaLeft, PLANS, planFor } from './plans';

describe('plans', () => {
  it('caps the free tier and leaves the top tier open', () => {
    expect(PLANS.FREE.invoiceQuota).toBe(10);
    expect(PLANS.BUSINESS.invoiceQuota).toBeNull();
  });

  it('blocks the eleventh free document and never blocks an unlimited plan', () => {
    expect(hasQuotaLeft('FREE', 9)).toBe(true);
    expect(hasQuotaLeft('FREE', 10)).toBe(false);
    expect(hasQuotaLeft('BUSINESS', 10_000)).toBe(true);
  });

  it('quotes every plan in lei with two decimals', () => {
    for (const code of ['FREE', 'STARTER', 'BUSINESS'] as const) {
      expect(planFor(code).priceMdl).toMatch(/^\d+\.\d{2}$/);
    }
  });
});
