import { describe, expect, it } from 'vitest';

import { monthStart, summarizeInvoices } from './invoice-summary';

describe('summarizeInvoices', () => {
  it('returns zeroes for a company with no documents', () => {
    expect(summarizeInvoices([], [])).toEqual({
      attentionCount: 0,
      draftCount: 0,
      errorCount: 0,
      awaitingBuyerCount: 0,
      awaitingBuyerTotal: '0.00',
      monthIssuedCount: 0,
      monthIssuedTotal: '0.00',
      monthFinishedCount: 0,
    });
  });

  it('groups what needs the supplier and what waits on the buyer', () => {
    const summary = summarizeInvoices(
      [
        { status: 'DRAFT', count: 2, total: '100.00' },
        { status: 'ERROR', count: 1, total: '50.00' },
        { status: 'CANCELLATION_REQUESTED', count: 1, total: '10.00' },
        { status: 'SENT', count: 3, total: '1200.10' },
        { status: 'RECEIVED', count: 1, total: '0.20' },
      ],
      [],
    );

    expect(summary.attentionCount).toBe(4);
    expect(summary.draftCount).toBe(2);
    expect(summary.errorCount).toBe(1);
    expect(summary.awaitingBuyerCount).toBe(4);
    expect(summary.awaitingBuyerTotal).toBe('1200.30');
  });

  it('does not count drafts, failures or cancellations as issued this month', () => {
    const summary = summarizeInvoices(
      [],
      [
        { status: 'DRAFT', count: 5, total: '999.00' },
        { status: 'ERROR', count: 1, total: '10.00' },
        { status: 'CANCELLED', count: 1, total: '20.00' },
        { status: 'FINISHED', count: 2, total: '240.00' },
        { status: 'SENT', count: 1, total: '0.10' },
      ],
    );

    expect(summary.monthIssuedCount).toBe(3);
    expect(summary.monthIssuedTotal).toBe('240.10');
    expect(summary.monthFinishedCount).toBe(2);
  });
});

describe('monthStart', () => {
  it('returns the first day of the same month', () => {
    expect(monthStart('2026-09-13')).toBe('2026-09-01');
    expect(monthStart('2026-12-31')).toBe('2026-12-01');
  });
});
