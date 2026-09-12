import { describe, expect, it } from 'vitest';

import {
  canSignOn,
  daysLeftToSign,
  MAX_DAYS_AHEAD,
  secondSignatureLeavesOnlyCancellation,
  validateIssueDate,
} from './issue-date';

const TODAY = '2026-09-12';

describe('validateIssueDate', () => {
  it('accepts today', () => {
    expect(validateIssueDate(TODAY, TODAY)).toEqual([]);
  });

  it('accepts exactly ten days ahead and refuses eleven', () => {
    expect(validateIssueDate('2026-09-22', TODAY)).toEqual([]);
    expect(validateIssueDate('2026-09-23', TODAY)).toEqual(['issue_date_too_far_ahead']);
  });

  it('refuses yesterday', () => {
    expect(validateIssueDate('2026-09-11', TODAY)).toEqual(['issue_date_in_past']);
  });

  it('counts the window in calendar days, weekends included', () => {
    expect(MAX_DAYS_AHEAD).toBe(10);
    expect(daysLeftToSign('2026-09-22', TODAY)).toBe(10);
  });

  it('handles a month boundary without drifting', () => {
    expect(validateIssueDate('2026-10-01', '2026-09-30')).toEqual([]);
    expect(validateIssueDate('2026-09-30', '2026-10-01')).toEqual(['issue_date_in_past']);
  });
});

describe('signing', () => {
  it('allows a signature on the issue date itself', () => {
    expect(canSignOn(TODAY, TODAY)).toBe(true);
  });

  it('allows signing a document dated ahead of today', () => {
    expect(canSignOn('2026-09-20', TODAY)).toBe(true);
  });

  it('refuses a signature once the issue date has passed', () => {
    expect(canSignOn('2026-09-11', TODAY)).toBe(false);
  });
});

describe('the Friday trap', () => {
  it('flags a document drafted Friday and signed off on Monday as unsalvageable', () => {
    const friday = '2026-09-11';
    const monday = '2026-09-14';

    expect(secondSignatureLeavesOnlyCancellation(friday, monday)).toBe(true);
    expect(daysLeftToSign(friday, monday)).toBeLessThan(0);
  });

  it('leaves a document dated today alone', () => {
    expect(secondSignatureLeavesOnlyCancellation(TODAY, TODAY)).toBe(false);
  });
});
