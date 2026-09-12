/// Password rules, as rules rather than as scattered ifs in the service.
/// Pure and framework-free, so the whole policy is covered by a fast test.

import { normalizePhone } from '@/common/utils/phone';

const MIN_LENGTH = 8;

export type PasswordViolation = 'password_too_short' | 'password_is_phone' | 'password_same_as_current';

export interface PasswordContext {
  phone?: string;
  /// Whether the candidate matches the password already in use. Compared by the
  /// service, which is the only place that can verify a hash.
  matchesCurrent?: boolean;
}

export function validatePassword(candidate: string, context: PasswordContext = {}): PasswordViolation[] {
  const violations: PasswordViolation[] = [];

  if (candidate.length < MIN_LENGTH) {
    violations.push('password_too_short');
  }

  // Compared in normalised form, because "069123456" and "+373 69 123 456" are
  // the same number and both are equally guessable.
  if (context.phone !== undefined && isSameNumber(candidate, context.phone)) {
    violations.push('password_is_phone');
  }

  if (context.matchesCurrent === true) {
    violations.push('password_same_as_current');
  }

  return violations;
}

function isSameNumber(candidate: string, phone: string): boolean {
  const normalized = normalizePhone(candidate);

  return normalized.length > 0 && normalized === normalizePhone(phone);
}
