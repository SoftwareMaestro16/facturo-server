/// The boundary between Facturo and the card acquirer.
///
/// Today that is maib e-commerce. The interface stays narrow enough that a
/// second acquirer, or a Romanian one when the product crosses the border,
/// is a new class rather than a rewrite.

export interface CheckoutRequest {
  /// Facturo's own payment row id, echoed back in the callback.
  referenceId: string;
  amount: string;
  currency: 'MDL';
  description: string;
  payerEmail: string;
  /// Interface language of the hosted page: "ro" or "ru".
  language: string;
}

export interface CheckoutSession {
  /// Where to send the customer's browser.
  checkoutUrl: string;
  /// The acquirer's identifier for the transaction.
  externalId: string;
}

export type PaymentState = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface PaymentCallback {
  referenceId: string;
  externalId: string;
  state: PaymentState;
  amount: string;
  currency: string;
}

export interface PaymentProvider {
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  getPayment(externalId: string): Promise<PaymentCallback>;
  /// Returns false for a body whose signature does not match. A false here is a
  /// forged or malformed callback, and it must never be treated as a soft
  /// failure to log and continue past.
  verifyCallback(rawBody: string): boolean;
  parseCallback(rawBody: string): PaymentCallback;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
