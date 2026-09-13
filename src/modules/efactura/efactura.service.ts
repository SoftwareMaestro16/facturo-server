import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { AuditService } from '@/common/audit/audit.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { BillingService } from '@/modules/billing/billing.service';

import { buildInvoiceXml } from './model/efactura-xml';
import { explain } from './model/error-catalogue';
import { canTransition, type InvoiceStatus } from '../invoices/model/invoice-status';
import {
  EFACTURA_PROVIDER,
  type EfacturaDocument,
  type EfacturaProvider,
  type SubmissionResult,
} from './providers/efactura-provider';

/// Owns submitting a document to the platform: building the XML, storing
/// evidence, and turning the platform's answer into a stable code the
/// interface can translate. Retries on top of this live in a scheduled
/// sweeper (added with the real provider); the failure classification is
/// already correct. Pulling and reviewing documents the company received
/// lives in IncomingDocumentsService instead — a different direction across
/// the same boundary, with different rules.
@Injectable()
export class EfacturaService {
  private readonly logger = new Logger(EfacturaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
    @Inject(forwardRef(() => EFACTURA_PROVIDER)) private readonly provider: EfacturaProvider,
  ) {}

  /// Signs the current draft and hands it to the platform.
  ///
  /// The whole thing lives in one transaction from Facturo's side, but not
  /// from the platform's: the network call is between two updates so a crash
  /// mid-flight does not lose the fact that we tried.
  async submit(companyId: string, invoiceId: string): Promise<InvoiceStatus> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { lines: { orderBy: { position: 'asc' } } },
    });

    if (!invoice) {
      throw new NotFoundException({ code: 'invoice_not_found', message: 'Invoice not found' });
    }

    if (!canTransition(invoice.cycle, invoice.status, 'SIGNED')) {
      throw new ConflictException({
        code: 'invoice_not_signable',
        message: `Not allowed to sign a document in state ${invoice.status}`,
      });
    }

    // Checked here, not at draft creation: a draft that is never signed cost
    // the company nothing, so quota is spent at the moment it is issued.
    await this.billing.assertCanIssueInvoice(companyId);

    const document = toDocument(invoice);
    const submission = await this.startSubmission(invoiceId, document);

    try {
      const result = await this.provider.submit(document);
      await this.applySubmissionResult(invoice.id, submission.id, result);
      await this.billing.recordInvoiceIssued(companyId);
      this.audit.record({
        type: 'INVOICE_SENT',
        userId: null,
        companyId,
        meta: { invoiceId, externalId: result.externalId, attempt: submission.attempt },
      });

      return 'SIGNED';
    } catch (error) {
      await this.applySubmissionFailure(invoice.id, submission.id, invoice.status, error);
      throw new BadRequestException({ code: extractCode(error), message: 'Submission failed' });
    }
  }

  private async startSubmission(
    invoiceId: string,
    document: EfacturaDocument,
  ): Promise<{ id: string; attempt: number }> {
    const attempt = (await this.prisma.efacturaSubmission.count({ where: { invoiceId } })) + 1;
    const requestXml = buildInvoiceXml(document);

    const submission = await this.prisma.efacturaSubmission.create({
      data: { invoiceId, attempt, state: 'IN_FLIGHT', requestXml },
    });

    return { id: submission.id, attempt };
  }

  private async applySubmissionFailure(
    invoiceId: string,
    submissionId: string,
    currentStatus: InvoiceStatus,
    error: unknown,
  ): Promise<void> {
    const code = extractCode(error);
    const explanation = explain(code);

    await this.prisma.$transaction([
      this.prisma.efacturaSubmission.update({
        where: { id: submissionId },
        data: {
          state: 'FAILED',
          errorCode: code,
          errorMessage: extractMessage(error),
          completedAt: new Date(),
        },
      }),
      this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          // A retryable failure leaves the customer's document where it was:
          // the queue will try again. Anything else is a dead end that the
          // customer has to see, so it becomes ERROR with a code.
          status: explanation.retryable ? currentStatus : 'ERROR',
          statusReason: code,
        },
      }),
    ]);

    this.logger.warn(`Submission ${submissionId} failed: ${code}`);
  }

  private async applySubmissionResult(
    invoiceId: string,
    submissionId: string,
    result: SubmissionResult,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.efacturaSubmission.update({
        where: { id: submissionId },
        data: {
          state: 'SUCCEEDED',
          responseRaw: result.responseRaw,
          completedAt: new Date(),
        },
      }),
      this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'SIGNED',
          statusReason: null,
          sentAt: new Date(),
          efacturaId: result.externalId,
          efacturaSeries: result.assignedSeries ?? null,
          efacturaNumber: result.assignedNumber ?? null,
        },
      }),
    ]);
  }
}

function toDocument(invoice: Prisma.InvoiceGetPayload<{ include: { lines: true } }>): EfacturaDocument {
  return {
    referenceId: invoice.id,
    cycle: invoice.cycle,
    draftSeries: invoice.series,
    draftNumber: invoice.number,
    issueDate: dateOnly(invoice.issueDate),
    deliveryDate: invoice.deliveryDate ? dateOnly(invoice.deliveryDate) : undefined,
    supplier: {
      // Supplier details come from Facturo's own company record. That query
      // is added when the SFS provider goes live, along with a joined select.
      // Until then the sandbox provider does not care.
      name: 'Supplier',
      idno: '0000000000000',
    },
    buyer: toBuyer(invoice),
    transport: toTransport(invoice),
    currency: invoice.currency,
    lines: invoice.lines.map(toLine),
    subtotal: invoice.subtotal.toFixed(2),
    vatTotal: invoice.vatTotal.toFixed(2),
    total: invoice.total.toFixed(2),
    notes: invoice.notes ?? undefined,
  };
}

function toBuyer(invoice: {
  counterpartyName: string;
  counterpartyIdno: string;
  counterpartyVatCode: string | null;
  counterpartyAddress: string | null;
}) {
  return {
    name: invoice.counterpartyName,
    idno: invoice.counterpartyIdno,
    vatCode: invoice.counterpartyVatCode ?? undefined,
    address: invoice.counterpartyAddress ?? undefined,
  };
}

function toTransport(invoice: {
  loadingPoint: string | null;
  unloadingPoint: string | null;
  transporterName: string | null;
  transporterIdno: string | null;
  vehicleNumber: string | null;
  driverName: string | null;
}) {
  const anyTransport = invoice.loadingPoint || invoice.unloadingPoint || invoice.transporterName;

  return anyTransport
    ? {
        loadingPoint: invoice.loadingPoint ?? undefined,
        unloadingPoint: invoice.unloadingPoint ?? undefined,
        transporterName: invoice.transporterName ?? undefined,
        transporterIdno: invoice.transporterIdno ?? undefined,
        vehicleNumber: invoice.vehicleNumber ?? undefined,
        driverName: invoice.driverName ?? undefined,
      }
    : undefined;
}

function toLine(line: {
  position: number;
  name: string;
  unit: string;
  quantity: Prisma.Decimal;
  priceNet: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  amountNet: Prisma.Decimal;
  vatAmount: Prisma.Decimal;
  amountGross: Prisma.Decimal;
}) {
  return {
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

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function extractCode(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'efactura_unknown_error';
  }

  const response = (error as { response?: unknown }).response;

  if (typeof response === 'object' && response !== null && 'code' in response) {
    const { code } = response;

    if (typeof code === 'string') {
      return code;
    }
  }

  return 'efactura_unknown_error';
}

function extractMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
