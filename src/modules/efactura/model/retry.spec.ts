import { describe, expect, it } from 'vitest';

import { DEFAULT_RETRY_POLICY, nextRetry, shouldRetry } from './retry';

/// A deterministic "random" so the jitter is testable.
const half = () => 0.5;
const zero = () => 0;
const almostOne = () => 0.9999;

describe('nextRetry', () => {
  it('grows the base delay exponentially before jitter is applied', () => {
    // Attempt 1: base * 2^0 = 30_000, jittered at 0.5 = 15_000
    expect(nextRetry(1, half).delayMs).toBe(15_000);
    // Attempt 2: base * 2^1 = 60_000, jittered at 0.5 = 30_000
    expect(nextRetry(2, half).delayMs).toBe(30_000);
    // Attempt 5: base * 2^4 = 480_000, jittered
    expect(nextRetry(5, half).delayMs).toBe(240_000);
  });

  it('never waits longer than the configured ceiling', () => {
    expect(nextRetry(10, almostOne).delayMs).toBeLessThanOrEqual(DEFAULT_RETRY_POLICY.maxDelayMs);
  });

  it('produces zero delay only when the random source itself is zero', () => {
    expect(nextRetry(3, zero).delayMs).toBe(0);
  });

  it('marks the final attempt', () => {
    expect(nextRetry(DEFAULT_RETRY_POLICY.maxAttempts, half).isFinal).toBe(true);
    expect(nextRetry(1, half).isFinal).toBe(false);
  });
});

describe('shouldRetry', () => {
  it('never retries a rejected document, no matter how few attempts we made', () => {
    expect(shouldRetry(false, 1)).toBe(false);
  });

  it('retries a transport failure until the attempt budget runs out', () => {
    expect(shouldRetry(true, 1)).toBe(true);
    expect(shouldRetry(true, DEFAULT_RETRY_POLICY.maxAttempts - 1)).toBe(true);
    expect(shouldRetry(true, DEFAULT_RETRY_POLICY.maxAttempts)).toBe(false);
  });
});
