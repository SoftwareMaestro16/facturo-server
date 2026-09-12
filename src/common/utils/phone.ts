/// Moldovan phone numbers reach us in every shape a human types: +373 69 123
/// 456, 069123456, 37369123456. They all mean the same subscriber, so anything
/// that compares or looks up a phone compares the national significant number.

const COUNTRY_CODE = '373';

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');

  if (digits.startsWith(COUNTRY_CODE)) {
    return digits.slice(COUNTRY_CODE.length);
  }

  // A national-format number carries a trunk zero that the international one
  // does not.
  return digits.startsWith('0') ? digits.slice(1) : digits;
}

/// Mobile and landline subscriber numbers in Moldova are eight digits.
export function isValidPhone(value: string): boolean {
  return /^\d{8}$/.test(normalizePhone(value));
}
