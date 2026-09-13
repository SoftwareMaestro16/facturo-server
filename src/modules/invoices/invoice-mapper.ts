import type { Prisma } from '@prisma/client';

import type { InvoiceResponse } from './dto';

/// Turns a Prisma invoice row into the API shape. Kept out of the service so
/// the service stays about behaviour and this file about naming.

type InvoiceRow = {
  id: string;
  direction: string;
  status: string;
  cycle: string;
  statusReason: string | null;
  disputedAt: Date | null;
  series: string;
  number: number;
  issueDate: Date;
  deliveryDate: Date | null;
  dueDate: Date | null;
  counterpartyId: string | null;
  counterpartyName: string;
  counterpartyIdno: string;
  counterpartyVatCode: string | null;
  counterpartyAddress: string | null;
  currency: string;
  subtotal: Prisma.Decimal;
  vatTotal: Prisma.Decimal;
  total: Prisma.Decimal;
  notes: string | null;
  loadingPoint: string | null;
  unloadingPoint: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines: LineRow[];
};

type LineRow = {
  id: string;
  position: number;
  name: string;
  unit: string;
  quantity: Prisma.Decimal;
  priceNet: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  amountNet: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  amountGross: Prisma.Decimal;
};

export function toInvoiceResponse(invoice: InvoiceRow): InvoiceResponse {
  return {
    id: invoice.id,
    direction: invoice.direction,
    status: invoice.status,
    cycle: invoice.cycle,
    statusReason: invoice.statusReason,
    disputedAt: invoice.disputedAt ? invoice.disputedAt.toISOString() : null,
    series: invoice.series,
    number: invoice.number,
    issueDate: dateOnly(invoice.issueDate),
    deliveryDate: invoice.deliveryDate ? dateOnly(invoice.deliveryDate) : null,
    dueDate: invoice.dueDate ? dateOnly(invoice.dueDate) : null,
    counterpartyId: invoice.counterpartyId,
    counterpartyName: invoice.counterpartyName,
    counterpartyIdno: invoice.counterpartyIdno,
    counterpartyVatCode: invoice.counterpartyVatCode,
    counterpartyAddress: invoice.counterpartyAddress,
    currency: invoice.currency,
    subtotal: invoice.subtotal.toFixed(2),
    vatTotal: invoice.vatTotal.toFixed(2),
    total: invoice.total.toFixed(2),
    notes: invoice.notes,
    loadingPoint: invoice.loadingPoint,
    unloadingPoint: invoice.unloadingPoint,
    lines: invoice.lines.map(toLineResponse),
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  };
}

function toLineResponse(line: LineRow) {
  return {
    id: line.id,
    position: line.position,
    name: line.name,
    unit: line.unit,
    quantity: line.quantity.toFixed(3),
    priceNet: line.priceNet.toFixed(2),
    vatRate: line.vatRate.toFixed(2),
    amountNet: line.amountNet.toFixed(2),
    vatAmount: line.vatAmount.toFixed(2),
    amountGross: line.amountGross.toFixed(2),
  };
}

/// The invoice date has no time of day, and comparing instants across a
/// timezone boundary would drift a document a day.
export function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}
