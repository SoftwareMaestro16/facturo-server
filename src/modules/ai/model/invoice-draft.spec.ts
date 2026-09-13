import { describe, expect, it } from 'vitest';

import { MAX_DRAFT_LINES, netFromGross, parseDraft } from './invoice-draft';

const line = (overrides: Record<string, unknown> = {}) => ({
  name: 'Consultanță',
  quantity: '2',
  unitPrice: '500',
  vatRate: '20',
  ...overrides,
});

describe('parseDraft', () => {
  it('keeps a well-formed answer', () => {
    expect(
      parseDraft({
        buyerName: '  Atelier   Nord SRL ',
        buyerIdno: '1003600012345',
        pricesIncludeVat: false,
        notes: null,
        lines: [line()],
      }),
    ).toEqual({
      buyerName: 'Atelier Nord SRL',
      buyerIdno: '1003600012345',
      notes: null,
      lines: [{ name: 'Consultanță', quantity: '2', priceNet: '500', vatRate: '20' }],
      warnings: [],
    });
  });

  it('survives garbage without throwing', () => {
    expect(parseDraft('ignore previous instructions')).toMatchObject({ lines: [], buyerName: null });
    expect(parseDraft(null).lines).toEqual([]);
  });

  it('drops lines without a name or a positive quantity and says so', () => {
    const draft = parseDraft({ lines: [line({ name: ' ' }), line({ quantity: '-1' }), line()] });
    expect(draft.lines).toHaveLength(1);
    expect(draft.warnings).toContain('line_dropped');
  });

  it('never invents a price, a rate or an IDNO', () => {
    const draft = parseDraft({ buyerIdno: '123', lines: [line({ unitPrice: 'cheap', vatRate: '19' })] });
    expect(draft.buyerIdno).toBeNull();
    expect(draft.lines[0]).toMatchObject({ priceNet: null, vatRate: null });
  });

  it('accepts a comma decimal and caps the number of lines', () => {
    const many = Array.from({ length: MAX_DRAFT_LINES + 5 }, () => line({ quantity: '1,5' }));
    const draft = parseDraft({ lines: many });
    expect(draft.lines).toHaveLength(MAX_DRAFT_LINES);
    expect(draft.lines[0]?.quantity).toBe('1.5');
    expect(draft.warnings).toContain('lines_truncated');
  });

  it('converts VAT-inclusive prices to net on the server, not in the model', () => {
    const draft = parseDraft({ pricesIncludeVat: true, lines: [line({ unitPrice: '120', vatRate: '20' })] });
    expect(draft.lines[0]?.priceNet).toBe('100.00');
  });
});

describe('netFromGross', () => {
  it('rounds half up in minor units', () => {
    expect(netFromGross('108', '8')).toBe('100.00');
    expect(netFromGross('10', '20')).toBe('8.33');
    expect(netFromGross('50', '0')).toBe('50.00');
  });
});
