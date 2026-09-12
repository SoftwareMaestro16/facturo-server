import { describe, expect, it } from 'vitest';

import { durationToMilliseconds, durationToSeconds } from './duration';

describe('durationToSeconds', () => {
  it('reads every unit the configuration uses', () => {
    expect(durationToSeconds('45s')).toBe(45);
    expect(durationToSeconds('15m')).toBe(900);
    expect(durationToSeconds('12h')).toBe(43_200);
    expect(durationToSeconds('30d')).toBe(2_592_000);
  });

  it('tolerates surrounding whitespace from an env file', () => {
    expect(durationToSeconds(' 15m ')).toBe(900);
  });

  it('refuses a form it does not understand instead of guessing', () => {
    expect(() => durationToSeconds('30 days')).toThrow(/Unsupported duration/);
    expect(() => durationToSeconds('30w')).toThrow(/Unsupported duration/);
    expect(() => durationToSeconds('')).toThrow(/Unsupported duration/);
  });
});

describe('durationToMilliseconds', () => {
  it('is the same value scaled, so the cookie and the token cannot drift', () => {
    expect(durationToMilliseconds('15m')).toBe(durationToSeconds('15m') * 1000);
  });
});
