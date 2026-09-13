import { ConflictException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '@/common/audit/audit.service';
import { PrismaService } from '@/common/prisma/prisma.service';

import { parseDay } from '../invoices/invoice-mapper';
import { nextNumberInSeries } from '../invoices/invoice-persistence';
import { canAcceptIncoming, canRejectIncoming } from '../invoices/model/incoming';
import type { InvoiceStatus } from '../invoices/model/invoice-status';
import {
  EFACTURA_PROVIDER,
  type EfacturaProvider,
  type IncomingDocument,
} from './providers/efactura-provider';

/// Facturo's own draft numbering for a document we did not create. It carries
/// no fiscal meaning for an incoming document — the platform's own series and
/// number are in efacturaSeries/efacturaNumber — it only exists to satisfy the
/// same (companyId, series, number) uniqueness every invoice row has.
const INCOMING_SERIES = 'IN';

/// The other direction across the platform boundary from EfacturaService:
/// pulling documents other companies sent to this one, and recording what the
/// buyer decided about each. See PLAN.md phase 3.
@Injectable()
export class IncomingDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(forwardRef(() => EFACTURA_PROVIDER)) private readonly provider: EfacturaProvider,
  ) {}

  /// There is no stored cursor yet: the real provider's pagination semantics
  /// are not known until it exists (see sfs-efactura.provider.ts), so this
  /// asks for everything in a fixed lookback window and relies on the dedupe
  /// in storeIncoming to make repeated syncing safe.
  async syncIncoming(companyId: string): Promise<{ created: number }> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const documents = await this.provider.listIncoming(since);
    let created = 0;

    for (const document of documents) {
      if (await this.storeIncoming(companyId, document)) {
        created += 1;
      }
    }

    return { created };
  }

  /// The buyer's signature, completing the long cycle. Short-cycle documents
  /// are never accepted this way — the supplier's paper copy is what finishes
  /// those — so canAcceptIncoming refuses anything but a fresh RECEIVED row.
  async acceptIncoming(companyId: string, invoiceId: string): Promise<InvoiceStatus> {
    const invoice = await this.findIncoming(companyId, invoiceId);

    if (!canAcceptIncoming(invoice.status) || !invoice.efacturaId) {
      throw new ConflictException({
        code: 'invoice_not_acceptable',
        message: `Not allowed to accept a document in state ${invoice.status}`,
      });
    }

    const result = await this.provider.act(invoice.efacturaId, 'SIGN');

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: result.state, statusReason: null, finishedAt: new Date() },
    });

    this.audit.record({
      type: 'INVOICE_STATUS_CHANGED',
      userId: null,
      companyId,
      meta: { invoiceId, action: 'ACCEPT_INCOMING', state: result.state },
    });

    return result.state;
  }

  /// A purely local record that the company does not recognise or agree with
  /// a document — see the comment on Invoice.disputedAt for why this never
  /// touches the platform or the mirrored `status`.
  async rejectIncoming(companyId: string, invoiceId: string, reason: string): Promise<void> {
    const invoice = await this.findIncoming(companyId, invoiceId);

    if (!canRejectIncoming(invoice.status, invoice.disputedAt)) {
      throw new ConflictException({
        code: 'invoice_not_rejectable',
        message: `Not allowed to dispute a document in state ${invoice.status}`,
      });
    }

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { disputedAt: new Date(), statusReason: reason },
    });

    this.audit.record({
      type: 'INVOICE_STATUS_CHANGED',
      userId: null,
      companyId,
      meta: { invoiceId, action: 'REJECT_INCOMING', reason },
    });
  }

  private async findIncoming(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId, direction: 'INCOMING' },
    });

    if (!invoice) {
      throw new NotFoundException({ code: 'invoice_not_found', message: 'Invoice not found' });
    }

    return invoice;
  }

  /// Returns true when a new row was created. False means this document was
  /// already synced — listIncoming has no promise of returning each document
  /// exactly once, so this is the boundary that makes syncing idempotent.
  private async storeIncoming(companyId: string, document: IncomingDocument): Promise<boolean> {
    const existing = await this.prisma.invoice.findFirst({
      where: { companyId, direction: 'INCOMING', efacturaId: document.externalId },
      select: { id: true },
    });

    if (existing) {
      return false;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.numberSeries.upsert({
        where: { companyId_series: { companyId, series: INCOMING_SERIES } },
        create: { companyId, series: INCOMING_SERIES },
        update: {},
      });

      const number = await nextNumberInSeries(tx, companyId, INCOMING_SERIES);

      await tx.invoice.create({
        data: {
          company: { connect: { id: companyId } },
          direction: 'INCOMING',
          status: 'RECEIVED',
          cycle: document.cycle,
          series: number.series,
          number: number.value,
          issueDate: parseDay(document.issueDate),
          counterpartyName: document.supplier.name,
          counterpartyIdno: document.supplier.idno,
          counterpartyVatCode: document.supplier.vatCode ?? null,
          counterpartyAddress: document.supplier.address ?? null,
          currency: document.currency,
          // The listing does not carry a subtotal/VAT breakdown, only the
          // total — that split would need line-level parsing of rawXml,
          // which is not built yet.
          total: document.total,
          efacturaId: document.externalId,
          efacturaSeries: document.series,
          efacturaNumber: document.number,
          rawXml: document.rawXml,
        },
      });
    });

    return true;
  }
}
