import { describe, expect, it } from 'vitest';

import { isValidPhone, normalizePhone } from './phone';

describe('normalizePhone', () => {
  it('collapses every way a Moldovan mobile is written to one value', () => {
    const forms = ['+373 69 123 456', '37369123456', '069123456', '069 123 456'];

    expect(new Set(forms.map(normalizePhone)).size).toBe(1);
    expect(normalizePhone(forms[0]!)).toBe('69123456');
  });

  it('accepts an eight digit subscriber number and rejects a truncated one', () => {
    expect(isValidPhone('+373 69 123 456')).toBe(true);
    expect(isValidPhone('6912345')).toBe(false);
  });
});
