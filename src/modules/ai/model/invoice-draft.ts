import { fromMinor, roundHalfUp, toMinor } from '@/common/utils/money';

/// What the model is allowed to answer, as a strict JSON Schema for the
/// Responses API. Strict mode needs every property listed as required and no
/// extra keywords such as maxItems or pattern — those limits are enforced
/// below, after the answer arrives, where a model cannot talk its way past them.
export const INVOICE_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['buyerName', 'buyerIdno', 'pricesIncludeVat', 'lines', 'notes'],
  properties: {
    buyerName: { type: ['string', 'null'], description: 'Buyer as written by the user, or null' },
    buyerIdno: { type: ['string', 'null'], description: '13-digit IDNO if the user wrote one, else null' },
    pricesIncludeVat: { type: 'boolean', description: 'True only if the text says the prices include VAT' },
    notes: {
      type: ['string', 'null'],
      description: 'A short note for the invoice if the user asked for one',
    },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'unitPrice', 'vatRate'],
        properties: {
          name: { type: 'string', description: 'Short line name in the language of the text' },
          quantity: { type: 'string', description: 'Decimal with a dot, up to 3 decimals' },
          unitPrice: {
            type: ['string', 'null'],
            description: 'Price per unit with a dot, or null if not stated',
          },
          vatRate: { type: ['string', 'null'], enum: ['20', '8', '0', null] },
        },
      },
    },
  },
} as const;

export type VatRate = '20' | '8' | '0';

export interface ParsedLine {
  name: string;
  quantity: string;
  /// Net of VAT, or null when the text did not state a price.
  priceNet: string | null;
  vatRate: VatRate | null;
}

export interface ParsedDraft {
  buyerName: string | null;
  buyerIdno: string | null;
  notes: string | null;
  lines: ParsedLine[];
  warnings: DraftWarning[];
}

export type DraftWarning = 'lines_truncated' | 'line_dropped';

export const MAX_DRAFT_LINES = 20;
const QUANTITY = /^\d{1,9}(?:\.\d{1,3})?$/;
const MONEY = /^\d{1,10}(?:\.\d{1,2})?$/;

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function decimal(value: unknown, pattern: RegExp): string | null {
  const candidate = typeof value === 'string' ? value.trim().replace(',', '.') : '';
  return pattern.test(candidate) && Number(candidate) > 0 ? candidate : null;
}

function vatRate(value: unknown): VatRate | null {
  return value === '20' || value === '8' || value === '0' ? value : null;
}

/// Net price from a VAT-inclusive one, in minor units so no float rounding
/// reaches the document.
export function netFromGross(gross: string, rate: VatRate): string {
  return fromMinor(roundHalfUp((toMinor(gross) * 100) / (100 + Number(rate))));
}

function parseLine(raw: unknown, includesVat: boolean, warnings: Set<DraftWarning>): ParsedLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const line = raw as Record<string, unknown>;
  const name = text(line.name, 200);
  const quantity = decimal(line.quantity, QUANTITY);
  if (!name || !quantity) {
    warnings.add('line_dropped');
    return null;
  }
  const rate = vatRate(line.vatRate);
  // A missing price is not a warning yet: the catalogue may still supply it.
  const price = decimal(line.unitPrice, MONEY);
  const priceNet = price && includesVat ? netFromGross(price, rate ?? '20') : price;
  return { name, quantity, priceNet, vatRate: rate };
}

/// Turns whatever came back into something the form may show, or nothing.
/// Everything is re-checked: types, lengths, decimal formats, the rate list.
export function parseDraft(raw: unknown): ParsedDraft {
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const warnings = new Set<DraftWarning>();
  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  if (rawLines.length > MAX_DRAFT_LINES) warnings.add('lines_truncated');

  const lines = rawLines
    .slice(0, MAX_DRAFT_LINES)
    .map((line) => parseLine(line, body.pricesIncludeVat === true, warnings))
    .filter((line): line is ParsedLine => line !== null);

  const idno = typeof body.buyerIdno === 'string' ? body.buyerIdno.replace(/\s/g, '') : '';

  return {
    buyerName: text(body.buyerName, 200),
    buyerIdno: /^\d{13}$/.test(idno) ? idno : null,
    notes: text(body.notes, 1000),
    lines,
    warnings: [...warnings],
  };
}
