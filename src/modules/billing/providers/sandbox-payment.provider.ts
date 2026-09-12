import { Injectable } from '@nestjs/common';

import type { CheckoutRequest, CheckoutSession, PaymentCallback, PaymentProvider } from './payment-provider';

/// Lets the whole subscription flow be developed and tested without an
/// acquirer account: the checkout url points back at the application, and
/// every callback verifies.
@Injectable()
export class SandboxPaymentProvider implements PaymentProvider {
  private readonly payments = new Map<string, PaymentCallback>();

  createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const externalId = `SANDBOX-PAY-${request.referenceId}`;

    this.payments.set(externalId, {
      referenceId: request.referenceId,
      externalId,
      state: 'PAID',
      amount: request.amount,
      currency: request.currency,
    });

    return Promise.resolve({
      checkoutUrl: `http://localhost:3000/${request.language}/billing/sandbox?payment=${externalId}`,
      externalId,
    });
  }

  getPayment(externalId: string): Promise<PaymentCallback> {
    const payment = this.payments.get(externalId);

    return Promise.resolve(
      payment ?? { referenceId: '', externalId, state: 'FAILED', amount: '0.00', currency: 'MDL' },
    );
  }

  verifyCallback(): boolean {
    return true;
  }

  parseCallback(rawBody: string): PaymentCallback {
    return JSON.parse(rawBody) as PaymentCallback;
  }
}
