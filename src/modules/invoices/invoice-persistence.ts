import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { CreateInvoiceDto, InvoiceLineDto } from './dto';
import type { InvoiceTotals } from './model/invoice-totals';
import { parseDay } from './invoice-mapper';

/// Prisma inputs assembled here rather than in the service body, so the two
/// places that need them (create and update) do not disagree about defaults.

export interface CounterpartySnapshot {
  id: string;
  name: string;
  idno: string;
  vatCode: string | null;
  address: string | null;
}

export function invoiceCreateData(
  companyId: string,
  dto: CreateInvoiceDto,
  counterparty: CounterpartySnapshot,
  totals: InvoiceTotals,
  series: string,
  number: number,
): Prisma.InvoiceCreateInput {
  return {
    company: { connect: { id: companyId } },
    direction: 'OUTGOING',
    cycle: dto.cycle ?? 'LONG',
    series,
    number,
    issueDate: parseDay(dto.issueDate),
    deliveryDate: dto.deliveryDate ? parseDay(dto.deliveryDate) : null,
    dueDate: dto.dueDate ? parseDay(dto.dueDate) : null,
    counterparty: { connect: { id: counterparty.id } },
    // Counterparty details are copied at issue time, and never re-read from the
    // directory: a later edit must not rewrite documents already sent.
    counterpartyName: counterparty.name,
    counterpartyIdno: counterparty.idno,
    counterpartyVatCode: counterparty.vatCode,
    counterpartyAddress: counterparty.address,
    currency: 'MDL',
    subtotal: totals.subtotal,
    vatTotal: totals.vatTotal,
    total: totals.total,
    notes: dto.notes ?? null,
    loadingPoint: dto.loadingPoint ?? null,
    unloadingPoint: dto.unloadingPoint ?? null,
    transporterName: dto.transporterName ?? null,
    transporterIdno: dto.transporterIdno ?? null,
    vehicleNumber: dto.vehicleNumber ?? null,
    driverName: dto.driverName ?? null,
    lines: { create: dto.lines.map((line, index) => lineData(line, index, totals)) },
  };
}

export function lineData(line: InvoiceLineDto, index: number, totals: InvoiceTotals) {
  const computed = totals.lines[index];

  return {
    position: index + 1,
    productId: line.productId ?? null,
    name: line.name,
    unit: line.unit ?? 'H87',
    quantity: line.quantity,
    priceNet: line.priceNet,
    vatRate: line.vatRate,
    amountNet: computed?.amountNet ?? '0.00',
    vatAmount: computed?.vatAmount ?? '0.00',
    amountGross: computed?.amountGross ?? '0.00',
  };
}

/// Hands out the next number in a series and increments it, inside the same
/// transaction that stores the invoice. Anything else lets two callers grab
/// the same number.
export async function nextNumberInSeries(
  tx: Prisma.TransactionClient,
  companyId: string,
  requestedSeries?: string,
): Promise<{ series: string; value: number }> {
  const series = requestedSeries
    ? await tx.numberSeries.findFirst({ where: { companyId, series: requestedSeries } })
    : await tx.numberSeries.findFirst({ where: { companyId, isDefault: true } });

  if (!series) {
    throw new BadRequestException({
      code: 'number_series_missing',
      message: 'No number series is configured',
    });
  }

  const value = series.nextValue;

  await tx.numberSeries.update({
    where: { id: series.id },
    data: { nextValue: value + 1 },
  });

  return { series: series.series, value };
}
