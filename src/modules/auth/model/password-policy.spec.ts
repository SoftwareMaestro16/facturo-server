import { describe, expect, it } from 'vitest';

import { validatePassword } from './password-policy';

describe('password policy', () => {
  it('accepts an ordinary eight character password', () => {
    expect(validatePassword('parola123')).toEqual([]);
  });

  it('rejects anything shorter than eight characters', () => {
    expect(validatePassword('short')).toContain('password_too_short');
  });

  it('rejects the account phone number in any punctuation', () => {
    expect(validatePassword('069123456', { phone: '+373 69 123 456' })).toContain('password_is_phone');
  });

  it('rejects reusing the current password', () => {
    expect(validatePassword('parola123', { matchesCurrent: true })).toContain('password_same_as_current');
  });
});
