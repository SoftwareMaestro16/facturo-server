import { ForbiddenException, Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import type { Payment, Prisma, Subscription } from '@prisma/client';

import { AuditService } from '@/common/audit/audit.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';

import {
  addMonth,
  canIssueInvoice,
  resolveSubscriptionState,
  type SubscriptionRecord,
} from './model/subscription-lifecycle';
import { planFor } from './model/plans';
import type { CheckoutDto, CheckoutResponse, SubscriptionResponse } from './dto';
import { PAYMENT_PROVIDER, type PaymentCallback, type PaymentProvider } from './providers/payment-provider';

/// The subscription and payment side of billing. The card acquirer boundary
/// lives entirely behind PaymentProvider — see providers/payment-provider.ts
/// and .claude/skills/payments-maib/SKILL.md for why the callback, not the
/// redirect, is what moves money here.
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(forwardRef(() => PAYMENT_PROVIDER)) private readonly provider: PaymentProvider,
  ) {}

  async getSubscription(companyId: string): Promise<SubscriptionResponse> {
    const resolved = await this.resolveAndPersist(companyId);

    return {
      plan: resolved.plan,
      status: resolved.status,
      invoiceQuota: planFor(resolved.plan).invoiceQuota,
      invoicesUsed: resolved.invoicesUsed,
      currentPeriodStart: resolved.currentPeriodStart.toISOString(),
      currentPeriodEnd: resolved.currentPeriodEnd.toISOString(),
    };
  }

  async checkout(companyId: string, user: AuthenticatedUser, dto: CheckoutDto): Promise<CheckoutResponse> {
    const plan = planFor(dto.plan);
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { locale: true },
    });

    const payment = await this.prisma.payment.create({
      data: { companyId, plan: dto.plan, amount: plan.priceMdl, currency: 'MDL', status: 'PENDING' },
    });

    const session = await this.provider.createCheckout({
      referenceId: payment.id,
      amount: plan.priceMdl,
      currency: 'MDL',
      description: `Facturo — ${plan.code}`,
      payerEmail: user.email,
      language: company.locale,
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { maibPayId: session.externalId },
    });

    // Best-effort only: this is what actually completes a sandbox purchase,
    // since the sandbox provider settles at createCheckout time with nobody
    // to call us back. The real provider reports through handleCallback
    // below, so a failure here — "not wired up yet" included — is never the
    // customer's problem, and never blocks handing back the checkout URL.
    try {
      const callback = await this.provider.getPayment(session.externalId);
      await this.applyPaymentCallback(callback);
    } catch (error) {
      this.logger.debug(`Immediate payment check skipped: ${extractMessage(error)}`);
    }

    return { checkoutUrl: session.checkoutUrl };
  }

  /// The verified source of truth for a payment. See the module doc: the
  /// redirect the customer's browser takes is not proof of anything.
  async handleCallback(rawBody: string): Promise<void> {
    if (!this.provider.verifyCallback(rawBody)) {
      this.audit.record({
        type: 'PAYMENT_RECEIVED',
        userId: null,
        companyId: null,
        meta: { rejected: true, reason: 'invalid_signature' },
      });

      throw new ForbiddenException({
        code: 'payment_invalid_signature',
        message: 'Invalid callback signature',
      });
    }

    await this.applyPaymentCallback(this.provider.parseCallback(rawBody));
  }

  /// Called before a document is signed and sent. See PLAN.md phase 4: quota
  /// is checked before issuing, not before drafting — a draft that is never
  /// signed cost the company nothing.
  async assertCanIssueInvoice(companyId: string): Promise<void> {
    const resolved = await this.resolveAndPersist(companyId);

    if (!canIssueInvoice(resolved)) {
      throw new ForbiddenException({
        code: 'quota_exceeded',
        message: 'This company has reached its monthly document limit',
      });
    }
  }

  async recordInvoiceIssued(companyId: string): Promise<void> {
    await this.prisma.subscription.update({
      where: { companyId },
      data: { invoicesUsed: { increment: 1 } },
    });
  }

  /// A retried callback, or the immediate check right after checkout, must
  /// never extend a period twice — Payment.maibPayId is the idempotency key.
  private async applyPaymentCallback(callback: PaymentCallback): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { maibPayId: callback.externalId } });

    if (!payment || payment.status === 'PAID') {
      return;
    }

    if (callback.state === 'FAILED') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', rawCallback: toJson(callback) },
      });

      return;
    }

    if (callback.state === 'PAID') {
      await this.applyPaidCallback(payment, callback);
    }
  }

  private async applyPaidCallback(payment: Payment, callback: PaymentCallback): Promise<void> {
    const plan = planFor(payment.plan);

    // "Paid" with the wrong amount is a discrepancy, not a payment, and must
    // not silently extend anything — it goes to a human instead.
    if (callback.amount !== plan.priceMdl || callback.currency !== 'MDL') {
      this.logger.warn(
        `Payment ${payment.id} callback amount mismatch: got ${callback.amount} ${callback.currency}, expected ${plan.priceMdl} MDL`,
      );

      return;
    }

    const now = new Date();
    const periodData = {
      plan: payment.plan,
      status: 'ACTIVE' as const,
      invoicesUsed: 0,
      currentPeriodStart: now,
      currentPeriodEnd: addMonth(now),
    };

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'PAID', paidAt: now, rawCallback: toJson(callback) },
      }),
      this.prisma.subscription.upsert({
        where: { companyId: payment.companyId },
        create: { companyId: payment.companyId, ...periodData },
        update: periodData,
      }),
    ]);

    this.audit.record({
      type: 'PAYMENT_RECEIVED',
      userId: null,
      companyId: payment.companyId,
      meta: { paymentId: payment.id, plan: payment.plan, amount: callback.amount },
    });
  }

  private async resolveAndPersist(companyId: string): Promise<SubscriptionRecord> {
    const subscription = await this.findOrCreateSubscription(companyId);
    const record = toRecord(subscription);
    const resolved = resolveSubscriptionState(record, new Date());

    if (resolved !== record) {
      await this.prisma.subscription.update({
        where: { companyId },
        data: {
          status: resolved.status,
          invoicesUsed: resolved.invoicesUsed,
          currentPeriodStart: resolved.currentPeriodStart,
          currentPeriodEnd: resolved.currentPeriodEnd,
        },
      });
    }

    return resolved;
  }

  private async findOrCreateSubscription(companyId: string): Promise<Subscription> {
    const existing = await this.prisma.subscription.findUnique({ where: { companyId } });

    if (existing) {
      return existing;
    }

    // A company created before Subscription rows existed, or one whose
    // creation the caller forgot to include in a transaction. Either way, a
    // company with no subscription defaults to FREE rather than failing.
    const now = new Date();

    return this.prisma.subscription.create({
      data: {
        companyId,
        plan: 'FREE',
        status: 'ACTIVE',
        invoicesUsed: 0,
        currentPeriodStart: now,
        currentPeriodEnd: addMonth(now),
      },
    });
  }
}

function toRecord(subscription: Subscription): SubscriptionRecord {
  return {
    plan: subscription.plan,
    status: subscription.status,
    invoicesUsed: subscription.invoicesUsed,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
  };
}

function toJson(callback: PaymentCallback): Prisma.InputJsonValue {
  return { ...callback };
}

function extractMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
