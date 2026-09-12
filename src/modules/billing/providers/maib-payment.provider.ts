import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { TypedConfigService } from '@/config/typed-config.service';

import { type CallbackObject, verifySignature } from '../model/maib-signature';

import type { CheckoutRequest, CheckoutSession, PaymentCallback, PaymentProvider } from './payment-provider';

/// maib e-commerce.
///
/// The shape of the flow is settled: authenticate with the project id and
/// secret to obtain a bearer token, register the payment, redirect the customer
/// to the returned page, and reconcile on the callback. The exact endpoint
/// paths and field names come from docs.maibmerchants.md once the business
/// account is enrolled for e-commerce; they are not guessed here, because a
/// wrong field name fails at the first real payment rather than in a test.
///
/// Signature verification is implemented, because that part is documented and
/// getting it wrong means accepting a forged "paid" callback. See
/// .claude/skills/payments-maib/SKILL.md.
@Injectable()
export class MaibPaymentProvider implements PaymentProvider {
  constructor(private readonly config: TypedConfigService) {}

  createCheckout(_request: CheckoutRequest): Promise<CheckoutSession> {
    return this.notReady();
  }

  getPayment(_externalId: string): Promise<PaymentCallback> {
    return this.notReady();
  }

  /// maib signs the `result` object of the callback with the project's
  /// Signature Key. The comparison is constant time so a forged signature
  /// cannot be discovered a character at a time.
  verifyCallback(rawBody: string): boolean {
    const parsed = safeParse(rawBody);

    if (!parsed) {
      return false;
    }

    const { result, signature } = parsed;

    return verifySignature(result, signature, this.config.get('MAIB_SIGNATURE_KEY') ?? '');
  }

  parseCallback(_rawBody: string): PaymentCallback {
    throw new ServiceUnavailableException({
      code: 'payment_provider_not_configured',
      message: 'The maib integration is not wired up yet.',
    });
  }

  private notReady(): Promise<never> {
    return Promise.reject(
      new ServiceUnavailableException({
        code: 'payment_provider_not_configured',
        message: 'The maib integration is not wired up yet.',
      }),
    );
  }
}

/// A callback body that is not the expected shape is not a soft failure to log
/// and continue past — it is either a bug or an attempt, and both mean reject.
function safeParse(rawBody: string): { result: CallbackObject; signature: string } | undefined {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return undefined;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return undefined;
  }

  const { result, signature } = parsed as { result?: unknown; signature?: unknown };

  if (typeof result !== 'object' || result === null || typeof signature !== 'string') {
    return undefined;
  }

  return { result: result as CallbackObject, signature };
}
