import { describe, expect, it } from 'vitest';

import { isLocked, LOCK_DURATION_MS, MAX_ATTEMPTS, registerFailure, registerSuccess } from './lockout';

const now = new Date('2026-09-12T10:00:00.000Z');

describe('lockout', () => {
  it('locks only on the fifth failure', () => {
    let state = { failedLoginAttempts: 0, lockedUntil: null as Date | null };

    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
      state = registerFailure(state, now);
      expect(isLocked(state, now)).toBe(false);
    }

    state = registerFailure(state, now);
    expect(isLocked(state, now)).toBe(true);
  });

  it('expires the lock rather than holding it forever', () => {
    const locked = {
      failedLoginAttempts: MAX_ATTEMPTS,
      lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS),
    };

    expect(isLocked(locked, new Date(now.getTime() + LOCK_DURATION_MS + 1))).toBe(false);
  });

  it('clears the counter on a successful login', () => {
    expect(registerSuccess()).toEqual({ failedLoginAttempts: 0, lockedUntil: null });
  });
});
