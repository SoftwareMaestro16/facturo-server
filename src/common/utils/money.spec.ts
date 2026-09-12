import { describe, expect, it } from 'vitest';

import { fromMinor, roundHalfUp, toMinor } from './money';

describe('money', () => {
  it('keeps the scale that a bank statement shows', () => {
    expect(fromMinor(2500)).toBe('25.00');
    expect(fromMinor(2550)).toBe('25.50');
  });

  it('survives the classic floating point pair', () => {
    expect(toMinor(0.1) + toMinor(0.2)).toBe(toMinor(0.3));
  });

  it('rounds halves away from zero in both directions', () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
  });
});
