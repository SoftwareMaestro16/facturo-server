/// Account lockout after repeated failures.
///
/// Temporary, not permanent: a director who mistypes on a phone keyboard five
/// times must not lose access to their invoicing on the day of a deadline.

export const MAX_ATTEMPTS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

export interface LockoutState {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

export function isLocked(state: LockoutState, now: Date = new Date()): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();
}

export function registerFailure(state: LockoutState, now: Date = new Date()): LockoutState {
  const attempts = state.failedLoginAttempts + 1;

  return {
    failedLoginAttempts: attempts,
    lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(now.getTime() + LOCK_DURATION_MS) : state.lockedUntil,
  };
}

export function registerSuccess(): LockoutState {
  return { failedLoginAttempts: 0, lockedUntil: null };
}
