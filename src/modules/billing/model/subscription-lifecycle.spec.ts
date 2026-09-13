import { describe, expect, it } from 'vitest';

import { canIssueInvoice, resolveSubscriptionState, type SubscriptionRecord } from './subscription-lifecycle';

const record = (overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord => ({
  plan: 'FREE',
  status: 'ACTIVE',
  invoicesUsed: 0,
  currentPeriodStart: new Date('2026-09-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2026-10-01T00:00:00.000Z'),
  ...overrides,
});

describe('resolveSubscriptionState', () => {
  it('leaves a subscription alone while its period has not ended', () => {
    const state = resolveSubscriptionState(record(), new Date('2026-09-15T00:00:00.000Z'));

    expect(state).toEqual(record());
  });

  it('rolls FREE to a fresh period with usage back at zero', () => {
    const now = new Date('2026-10-02T00:00:00.000Z');
    const state = resolveSubscriptionState(record({ invoicesUsed: 9 }), now);

    expect(state.status).toBe('ACTIVE');
    expect(state.invoicesUsed).toBe(0);
    expect(state.currentPeriodStart).toEqual(now);
  });

  it('sends a lapsed paid plan to PAST_DUE without resetting usage', () => {
    const now = new Date('2026-10-02T00:00:00.000Z');
    const state = resolveSubscriptionState(record({ plan: 'STARTER', invoicesUsed: 42 }), now);

    expect(state.status).toBe('PAST_DUE');
    expect(state.invoicesUsed).toBe(42);
  });

  it('leaves a cancelled subscription cancelled', () => {
    const state = resolveSubscriptionState(
      record({ plan: 'STARTER', status: 'CANCELLED' }),
      new Date('2026-10-02T00:00:00.000Z'),
    );

    expect(state.status).toBe('CANCELLED');
  });
});

describe('canIssueInvoice', () => {
  it('allows an active subscription with quota left', () => {
    expect(canIssueInvoice(record({ invoicesUsed: 9 }))).toBe(true);
  });

  it('refuses once the plan quota is used up', () => {
    expect(canIssueInvoice(record({ invoicesUsed: 10 }))).toBe(false);
  });

  it('refuses a past-due subscription regardless of usage', () => {
    expect(canIssueInvoice(record({ status: 'PAST_DUE', invoicesUsed: 0 }))).toBe(false);
  });

  it('never refuses BUSINESS on quota, since it has none', () => {
    expect(canIssueInvoice(record({ plan: 'BUSINESS', invoicesUsed: 100_000 }))).toBe(true);
  });
});
