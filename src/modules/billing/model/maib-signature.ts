/// Verifying that a payment callback really came from maib.
///
/// The algorithm is maib's, not ours, and it is unusual enough to be worth
/// spelling out. Given the `result` object from the callback body:
///
///   1. sort its keys, recursively, in ascending order;
///   2. take the values in that order;
///   3. append the project's Signature Key as the final value;
///   4. join everything with a colon;
///   5. SHA-256 the resulting string and base64 the raw digest.
///
/// The outcome is compared against the `signature` field of the callback.
///
/// This lives in model/ with no framework around it because it is the one piece
/// of the payment flow where being wrong means either accepting a forged
/// "payment succeeded" or rejecting real money. It gets tests.

import { createHash, timingSafeEqual } from 'node:crypto';

export type CallbackValue = string | number | boolean | null | CallbackObject | CallbackValue[];

export interface CallbackObject {
  [key: string]: CallbackValue;
}

/// Only leaves reach this function; objects and arrays are walked before it.
/// Absent values become empty fields rather than disappearing, which is what
/// the reference implementation does by way of PHP's string conversion.
function stringifyLeaf(value: string | number | boolean | null): string {
  if (value === null) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '';
  }

  return typeof value === 'number' ? String(value) : value;
}

function flattenSorted(value: CallbackValue): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenSorted);
  }

  if (value !== null && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .flatMap((key) => flattenSorted(value[key] ?? null));
  }

  return [stringifyLeaf(value)];
}

export function buildSignString(result: CallbackObject, signatureKey: string): string {
  return [...flattenSorted(result), signatureKey].join(':');
}

export function computeSignature(result: CallbackObject, signatureKey: string): string {
  return createHash('sha256').update(buildSignString(result, signatureKey), 'utf8').digest('base64');
}

/// Constant-time comparison. A byte-at-a-time comparison lets an attacker
/// discover a valid signature one character per request.
export function verifySignature(result: CallbackObject, received: string, signatureKey: string): boolean {
  if (!signatureKey || !received) {
    return false;
  }

  const expected = Buffer.from(computeSignature(result, signatureKey), 'utf8');
  const actual = Buffer.from(received, 'utf8');

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
