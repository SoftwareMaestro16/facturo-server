import { describe, expect, it } from 'vitest';

import { calculateInvoice, calculateLine } from './invoice-totals';

describe('calculateLine', () => {
  it('applies the standard 20 percent rate', () => {
    expect(calculateLine({ quantity: '1', priceNet: '100.00', vatRate: '20' })).toEqual({
      amountNet: '100.00',
      vatAmount: '20.00',
      amountGross: '120.00',
    });
  });

  it('keeps three decimals of quantity meaningful', () => {
    expect(calculateLine({ quantity: '2.500', priceNet: '10.00', vatRate: '20' })).toMatchObject({
      amountNet: '25.00',
      vatAmount: '5.00',
    });
  });

  it('handles the reduced rate and a zero rate', () => {
    expect(calculateLine({ quantity: '1', priceNet: '100.00', vatRate: '8' }).vatAmount).toBe('8.00');
    expect(calculateLine({ quantity: '1', priceNet: '100.00', vatRate: '0' }).vatAmount).toBe('0.00');
  });
});

describe('calculateInvoice', () => {
  it('sums lines that were each rounded first', () => {
    const totals = calculateInvoice([
      { quantity: '3', priceNet: '33.33', vatRate: '20' },
      { quantity: '1', priceNet: '0.01', vatRate: '20' },
    ]);

    expect(totals.subtotal).toBe('100.00');
    expect(totals.vatTotal).toBe('20.00');
    expect(totals.total).toBe('120.00');
  });

  it('returns zeroes for an empty invoice rather than throwing', () => {
    expect(calculateInvoice([])).toMatchObject({ subtotal: '0.00', vatTotal: '0.00', total: '0.00' });
  });
});
