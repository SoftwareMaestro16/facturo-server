/// Invoice arithmetic. No NestJS, no Prisma, no I/O — the whole point of this
/// file is that it can be exercised by a unit test in milliseconds, because a
/// rounding mistake here becomes a VAT discrepancy at the tax office.

import { roundHalfUp, toMinor } from '@/common/utils/money';

export interface LineInput {
  /// Three decimals, as a string to avoid a float ever entering the pipeline.
  quantity: string;
  /// Net unit price, VAT excluded.
  priceNet: string;
  /// 20, 8, 0 — a percentage, not a fraction.
  vatRate: string;
}

export interface LineTotals {
  amountNet: string;
  vatAmount: string;
  amountGross: string;
}

export interface InvoiceTotals {
  lines: LineTotals[];
  subtotal: string;
  vatTotal: string;
  total: string;
}

const QUANTITY_SCALE = 1000;

/// Rounds each line to bani first, then sums. Summing unrounded lines and
/// rounding once at the end drifts from what the e-Factura validator computes,
/// and a one-ban mismatch rejects the whole document.
export function calculateLine(line: LineInput): LineTotals {
  const quantityMilli = Math.round(Number(line.quantity) * QUANTITY_SCALE);
  const priceMinor = toMinor(line.priceNet);
  const vatRate = Number(line.vatRate);

  const amountNetMinor = roundHalfUp((quantityMilli * priceMinor) / QUANTITY_SCALE);
  const vatAmountMinor = roundHalfUp((amountNetMinor * vatRate) / 100);

  return {
    amountNet: minorToString(amountNetMinor),
    vatAmount: minorToString(vatAmountMinor),
    amountGross: minorToString(amountNetMinor + vatAmountMinor),
  };
}

export function calculateInvoice(lines: readonly LineInput[]): InvoiceTotals {
  const calculated = lines.map(calculateLine);

  const subtotalMinor = calculated.reduce((sum, line) => sum + toMinor(line.amountNet), 0);
  const vatTotalMinor = calculated.reduce((sum, line) => sum + toMinor(line.vatAmount), 0);

  return {
    lines: calculated,
    subtotal: minorToString(subtotalMinor),
    vatTotal: minorToString(vatTotalMinor),
    total: minorToString(subtotalMinor + vatTotalMinor),
  };
}

function minorToString(minor: number): string {
  return (minor / 100).toFixed(2);
}
