import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { pageMeta } from '@/common/dto';
import { PrismaService } from '@/common/prisma/prisma.service';

import type { CreateInvoiceDto, InvoicePage, InvoiceQuery, InvoiceResponse, UpdateInvoiceDto } from './dto';
import {
  type CounterpartySnapshot,
  invoiceCreateData,
  lineData,
  nextNumberInSeries,
} from './invoice-persistence';
import { dateOnly, parseDay, toInvoiceResponse } from './invoice-mapper';
import { calculateInvoice, type LineInput } from './model/invoice-totals';
import type { InvoiceSummaryResponse } from './dto/summary.dto';
import { isEditable } from './model/invoice-status';
import { monthStart, summarizeInvoices } from './model/invoice-summary';
import { validateIssueDate } from './model/issue-date';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, query: InvoiceQuery): Promise<InvoicePage> {
    const where: Prisma.InvoiceWhereInput = {
      companyId,
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.status ? { status: query.status as Prisma.InvoiceWhereInput['status'] } : {}),
      ...(query.search
        ? {
            OR: [
              { counterpartyName: { contains: query.search, mode: 'insensitive' } },
              { series: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: [{ issueDate: 'desc' }, { number: 'desc' }],
        skip: query.skip,
        take: query.pageSize,
        select: LIST_SELECTION,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        direction: row.direction,
        status: row.status,
        cycle: row.cycle,
        series: row.series,
        number: row.number,
        issueDate: dateOnly(row.issueDate),
        counterpartyName: row.counterpartyName,
        total: row.total.toFixed(2),
        currency: row.currency,
      })),
      meta: pageMeta(query, total),
    };
  }

  async summary(companyId: string): Promise<InvoiceSummaryResponse> {
    const today = new Date().toISOString().slice(0, 10);
    const outgoing = { companyId, direction: 'OUTGOING' as const };
    const aggregate = { _count: { _all: true }, _sum: { total: true } } as const;

    const [allTime, thisMonth] = await Promise.all([
      this.prisma.invoice.groupBy({ by: ['status'], where: outgoing, ...aggregate }),
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: { ...outgoing, issueDate: { gte: parseDay(monthStart(today)) } },
        ...aggregate,
      }),
    ]);

    const toGroup = (row: (typeof allTime)[number]) => ({
      status: row.status,
      count: row._count._all,
      total: row._sum.total?.toFixed(2) ?? '0.00',
    });

    return summarizeInvoices(allTime.map(toGroup), thisMonth.map(toGroup));
  }

  async findOne(companyId: string, id: string): Promise<InvoiceResponse> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      include: { lines: { orderBy: { position: 'asc' } } },
    });

    if (!invoice) {
      throw notFound();
    }

    return toInvoiceResponse(invoice);
  }

  async create(companyId: string, dto: CreateInvoiceDto): Promise<InvoiceResponse> {
    this.assertIssueDate(dto.issueDate);

    const counterparty = await this.loadCounterparty(companyId, dto.counterpartyId);
    const totals = calculateInvoice(dto.lines.map(toLineInput));

    const invoice = await this.prisma.$transaction(async (tx) => {
      const number = await nextNumberInSeries(tx, companyId, dto.series);

      return tx.invoice.create({
        data: invoiceCreateData(companyId, dto, counterparty, totals, number.series, number.value),
        include: { lines: { orderBy: { position: 'asc' } } },
      });
    });

    return toInvoiceResponse(invoice);
  }

  async update(companyId: string, id: string, dto: UpdateInvoiceDto): Promise<InvoiceResponse> {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      select: { status: true },
    });

    if (!existing) {
      throw notFound();
    }

    if (!isEditable(existing.status)) {
      throw new ConflictException({
        code: 'invoice_not_editable',
        message: 'Only a draft may be edited',
      });
    }

    if (dto.issueDate !== undefined) {
      this.assertIssueDate(dto.issueDate);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.applyScalarUpdate(tx, id, dto);
      await this.applyLinesUpdate(tx, id, dto.lines);
    });

    return this.findOne(companyId, id);
  }

  async remove(companyId: string, id: string): Promise<void> {
    const existing = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      select: { status: true },
    });

    if (!existing) {
      throw notFound();
    }

    if (!isEditable(existing.status)) {
      throw new ConflictException({
        code: 'invoice_not_draft',
        message: 'Only a draft may be deleted; a sent document has to be cancelled',
      });
    }

    await this.prisma.invoice.delete({ where: { id } });
  }

  /// Recomputes totals without saving. The form uses this so it can show a live
  /// total as the customer types, without repeating the arithmetic on the
  /// client and drifting from what the server would compute.
  preview(lines: CreateInvoiceDto['lines']) {
    return calculateInvoice(lines.map(toLineInput));
  }

  private async loadCounterparty(companyId: string, id: string): Promise<CounterpartySnapshot> {
    const row = await this.prisma.counterparty.findFirst({
      where: { id, companyId },
      select: { id: true, name: true, idno: true, vatCode: true, address: true },
    });

    if (!row) {
      throw new BadRequestException({
        code: 'counterparty_not_found',
        message: 'Counterparty not found',
      });
    }

    return row;
  }

  private assertIssueDate(issueDate: string): void {
    const today = new Date().toISOString().slice(0, 10);
    const violations = validateIssueDate(issueDate, today);

    if (violations.length > 0) {
      throw new BadRequestException({
        // The tax platform's own error code, so the interface uses one
        // translation for both sources.
        code: `efactura_${violations[0]}`,
        message: violations.join(', '),
      });
    }
  }

  private async applyScalarUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    dto: UpdateInvoiceDto,
  ): Promise<void> {
    const totals = dto.lines ? calculateInvoice(dto.lines.map(toLineInput)) : undefined;

    await tx.invoice.update({
      where: { id },
      data: {
        cycle: dto.cycle,
        issueDate: dto.issueDate ? parseDay(dto.issueDate) : undefined,
        deliveryDate: dto.deliveryDate ? parseDay(dto.deliveryDate) : undefined,
        dueDate: dto.dueDate ? parseDay(dto.dueDate) : undefined,
        notes: dto.notes,
        loadingPoint: dto.loadingPoint,
        unloadingPoint: dto.unloadingPoint,
        transporterName: dto.transporterName,
        transporterIdno: dto.transporterIdno,
        vehicleNumber: dto.vehicleNumber,
        driverName: dto.driverName,
        subtotal: totals?.subtotal,
        vatTotal: totals?.vatTotal,
        total: totals?.total,
      },
    });
  }

  private async applyLinesUpdate(
    tx: Prisma.TransactionClient,
    id: string,
    lines: UpdateInvoiceDto['lines'],
  ): Promise<void> {
    if (!lines) {
      return;
    }

    const totals = calculateInvoice(lines.map(toLineInput));

    // Replace-all rather than a fine-grained diff: a draft rarely has many
    // lines, and reconciling positions and productId would only add bugs.
    await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
    await tx.invoiceLine.createMany({
      data: lines.map((line, index) => ({ invoiceId: id, ...lineData(line, index, totals) })),
    });
  }
}

function toLineInput(line: { quantity: string; priceNet: string; vatRate: string }): LineInput {
  return { quantity: line.quantity, priceNet: line.priceNet, vatRate: line.vatRate };
}

function notFound(): NotFoundException {
  return new NotFoundException({ code: 'invoice_not_found', message: 'Invoice not found' });
}

const LIST_SELECTION = {
  id: true,
  direction: true,
  status: true,
  cycle: true,
  series: true,
  number: true,
  issueDate: true,
  counterpartyName: true,
  total: true,
  currency: true,
} as const;
