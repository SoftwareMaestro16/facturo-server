import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { TypedConfigService } from '@/config/typed-config.service';

import type { CheckoutRequest, CheckoutSession, PaymentCallback, PaymentProvider } from './payment-provider';

/// maib e-commerce.
///
/// The request shape is settled: authenticate with project id and secret to get
/// a bearer token, register a checkout, redirect the customer to the returned
/// url, and reconcile on the callback. The exact endpoint paths and field names
/// come from docs.maibmerchants.md once the business account is enrolled for
/// e-commerce — they are not guessed here, because a wrong field name fails at
/// the first real payment rather than in a test.
@Injectable()
export class MaibPaymentProvider implements PaymentProvider {
  constructor(private readonly config: TypedConfigService) {}

  createCheckout(_request: CheckoutRequest): Promise<CheckoutSession> {
    return this.notReady();
  }

  getPayment(_externalId: string): Promise<PaymentCallback> {
    return this.notReady();
  }

  /// maib signs the callback body with the project's signature key and sends
  /// the digest as "sha256=<hex>". Comparison is constant time so a forged
  /// signature cannot be discovered a byte at a time.
  verifyCallback(rawBody: string, signatureHeader: string): boolean {
    const key = this.config.get('MAIB_SIGNATURE_KEY');

    if (!key) {
      return false;
    }

    const expected = `sha256=${createHmac('sha256', key).update(rawBody, 'utf8').digest('hex')}`;
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const receivedBuffer = Buffer.from(signatureHeader, 'utf8');

    return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
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
