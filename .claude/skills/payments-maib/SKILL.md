---
name: payments-maib
description: Rules for taking card payments through maib e-commerce — what may never be stored, callback verification and idempotency, refunds, reconciliation, receipts, and the subscription lifecycle. Use for anything touching src/modules/billing.
---

# Taking money through maib

Facturo charges a monthly subscription to a Moldovan business account with maib
e-commerce. Everything below exists because getting it wrong means either losing
money, taking money twice, or handling card data we have no right to touch.

## The one rule that is not ours to bend

**Card numbers never reach our servers.** Not in a log, not in a database, not
in a Sentry breadcrumb, not "temporarily". The customer enters the card on
maib's own hosted page. What comes back is a token: the `billerId` for a saved
card, and a payment identifier for the transaction.

Storing a card number puts the whole business inside PCI DSS scope, which is a
different company from the one being built here. If a code change would make a
card number pass through this codebase, the change is wrong.

The same applies to CVV, expiry and cardholder name. Store none of it.

## The flow

1. The customer picks a plan. We create a `Payment` row in `PENDING` with our
   own reference id.
2. We authenticate to maib with the project id and secret and get a bearer
   token. Tokens are short-lived and refreshed, never hard-coded.
3. We register the payment and receive a URL. The customer's browser goes there.
4. maib takes the card details on its own page, runs 3-D Secure, and returns the
   customer to our success or fail URL.
5. **maib calls our callback URL with the result.** This, not the redirect, is
   the source of truth.
6. We verify the signature, update the `Payment` row, and extend the
   subscription.

**The redirect is not proof of payment.** A customer can close the tab before it
happens, or open the success URL by hand. Only the verified callback moves money
in our model.

## Verifying the callback

The algorithm is implemented and tested in
`src/modules/billing/model/maib-signature.ts`. Given the `result` object from
the callback body:

1. sort its keys recursively in ascending order;
2. take the values in that order;
3. append the project's Signature Key as the final value;
4. join with a colon;
5. SHA-256, then base64 the raw digest;
6. compare against the `signature` field, in **constant time**.

A mismatch is not a soft failure to log and continue past. It is a forged
callback: return a non-2xx, write an audit event, change nothing.

A body that does not parse, or that lacks `result` or `signature`, is treated
the same way.

> maib also publishes a newer Checkout API whose callback is signed differently:
> HMAC-SHA256 over the raw body plus a timestamp, sent as an `X-Signature`
> header of the form `sha256=<base64>`. Facturo uses the classic e-commerce API.
> If that ever changes, the verifier changes with it — do not try to make one
> function serve both.

## Idempotency

maib may deliver the same callback more than once. A retried delivery must not
extend the subscription twice.

- `Payment.maibPayId` is unique. Handle the callback inside a transaction that
  finds the row by that id.
- If the row is already `PAID`, respond 200 and do nothing else. Answering with
  an error makes the sender retry forever.
- Never key idempotency on our own reference id alone: a customer who abandons a
  checkout and starts another one has two payments for one plan.

## Amounts

- Amounts are `Decimal(12, 2)` in the database and fixed-scale strings on the
  wire. A float has already lost the bani.
- **Verify the amount in the callback against the plan's price.** A callback
  that says paid but carries the wrong amount is not a payment; it is a
  discrepancy, and it goes to a human.
- Currency is MDL. If the value in a callback is anything else, reject it.

## Refunds and disputes

- A refund goes through maib's refund operation against the original payment.
  Never by hand at the bank, because then the two records disagree.
- A refunded payment sets `Payment.status = REFUNDED` and the subscription
  period is shortened to match. A customer who was refunded but keeps the
  service is money lost quietly.
- Keep the raw callback body in `Payment.rawCallback`. When the bank disputes
  what happened, that field is the evidence.

## Reconciliation

Once a week, compare what maib says settled against `Payment` rows marked
`PAID`. Two failure modes this catches, both of which have happened to everyone
who skipped it:

- a callback that never arrived, so the customer paid and has no service;
- a payment marked paid on our side that never settled.

Neither shows up in normal use. Both show up in reconciliation.

## Receipts and the legal side

- The customer receives a receipt for every charge, in their interface language,
  with our IDNO, the amount, the VAT breakdown and the period covered.
- Facturo's own invoices to its customers are subject to the same electronic
  invoicing mandate as anyone else's. Once Facturo is VAT registered, its
  subscription invoices go through e-Factura too.
- The price shown in the interface is the price charged, VAT included. A
  different number at the checkout is the fastest way to a chargeback.

## Subscription lifecycle

- A period is extended only by a verified, correctly-valued callback.
- When a period ends without payment, the subscription goes to `PAST_DUE` and
  **the data stays**. Never delete a customer's invoices for non-payment: they
  are fiscal records they are legally required to keep for six years. Limit what
  they can create, not what they can read.
- A saved card is stored as maib's `billerId` and nothing else. The customer can
  remove it, and removing it must actually delete the token at maib.
- Warn before charging a saved card, not after.

## Environment

```
MAIB_PROVIDER=sandbox|maib
MAIB_PROJECT_ID=
MAIB_PROJECT_SECRET=
MAIB_SIGNATURE_KEY=
MAIB_CALLBACK_URL=
MAIB_SUCCESS_URL=
MAIB_FAIL_URL=
```

The config validator refuses to boot in production with `MAIB_PROVIDER=sandbox`,
because the sandbox verifier accepts every callback.

## Before go-live

1. Business account enrolled for e-commerce with maib, project activated,
   Signature Key issued.
2. One real payment of a small amount, refunded, with both the charge and the
   refund reconciled against the bank statement.
3. A deliberately forged callback rejected, and the rejection visible in the
   audit log.
4. A duplicate callback delivered twice, with the subscription extended once.
5. Support contact recorded: maib e-commerce, `ecom@maib.md`, phone 1314.
