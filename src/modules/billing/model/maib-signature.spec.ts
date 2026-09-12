import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { buildSignString, computeSignature, verifySignature } from './maib-signature';

const KEY = 'signature-key-from-project-settings';

const RESULT = {
  payId: 'b1a2c3',
  orderId: 'facturo-42',
  status: 'OK',
  amount: 249,
  currency: 'MDL',
};

describe('buildSignString', () => {
  it('orders values by key name, not by the order they arrived in', () => {
    expect(buildSignString(RESULT, KEY)).toBe(`249:MDL:facturo-42:b1a2c3:OK:${KEY}`);
  });

  it('produces the same string however the object was serialised', () => {
    const reordered = {
      currency: 'MDL',
      status: 'OK',
      amount: 249,
      payId: 'b1a2c3',
      orderId: 'facturo-42',
    };

    expect(buildSignString(reordered, KEY)).toBe(buildSignString(RESULT, KEY));
  });

  it('walks nested objects in sorted order too', () => {
    expect(buildSignString({ b: 'two', a: { y: '2', x: '1' } }, KEY)).toBe(`1:2:two:${KEY}`);
  });

  it('renders a missing value as an empty field rather than dropping it', () => {
    expect(buildSignString({ a: 'x', b: null }, KEY)).toBe(`x::${KEY}`);
  });
});

describe('computeSignature', () => {
  it('is the base64 of the raw sha-256 digest of the sign string', () => {
    const expected = createHash('sha256').update(buildSignString(RESULT, KEY), 'utf8').digest('base64');

    expect(computeSignature(RESULT, KEY)).toBe(expected);
  });
});

describe('verifySignature', () => {
  it('accepts the signature it would itself produce', () => {
    expect(verifySignature(RESULT, computeSignature(RESULT, KEY), KEY)).toBe(true);
  });

  it('rejects a callback whose amount was tampered with', () => {
    const signature = computeSignature(RESULT, KEY);

    expect(verifySignature({ ...RESULT, amount: 1 }, signature, KEY)).toBe(false);
  });

  it('rejects a signature made with a different key', () => {
    expect(verifySignature(RESULT, computeSignature(RESULT, 'other-key'), KEY)).toBe(false);
  });

  it('refuses everything when the key is not configured, rather than passing', () => {
    expect(verifySignature(RESULT, computeSignature(RESULT, KEY), '')).toBe(false);
    expect(verifySignature(RESULT, '', KEY)).toBe(false);
  });
});
