import { describe, expect, it } from 'vitest';

import { hasAiQuota, utcDayStart } from './quota';

describe('AI quota', () => {
  it('starts the day at midnight UTC', () => {
    expect(utcDayStart(new Date('2026-09-13T23:59:59+03:00')).toISOString()).toBe('2026-09-13T00:00:00.000Z');
    expect(utcDayStart(new Date('2026-09-14T01:30:00+03:00')).toISOString()).toBe('2026-09-13T00:00:00.000Z');
  });

  it('allows calls until the limit is reached', () => {
    expect(hasAiQuota(0, 30)).toBe(true);
    expect(hasAiQuota(29, 30)).toBe(true);
    expect(hasAiQuota(30, 30)).toBe(false);
  });
});
