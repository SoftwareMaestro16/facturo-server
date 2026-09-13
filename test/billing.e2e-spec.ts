import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../src/common/prisma/prisma.service';

import { body, cookiesOf, createTestApp, readCookie, resetDatabase } from './helpers/app';

const OWNER = {
  companyName: 'SRL Alfa',
  idno: '1003600000001',
  vatCode: '000001',
  email: 'a@exemplu.md',
  fullName: 'Ana Alfa',
  password: 'parola-buna-2026',
};

const PARTNER = {
  name: 'SRL Partener',
  idno: '1009600054321',
  vatCode: '123456',
  address: 'str. Ștefan cel Mare 1, Chișinău',
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Subscription {
  plan: string;
  status: string;
  invoiceQuota: number | null;
  invoicesUsed: number;
}

describe('billing', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;
  let cookie: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const registered = await request(server).post('/api/auth/register').send(OWNER).expect(201);
    cookie = readCookie(cookiesOf(registered), 'access_token') ?? '';
  });

  it('starts every company on FREE with ten documents a month', async () => {
    const response = await request(server).get('/api/billing/subscription').set('Cookie', cookie).expect(200);
    const subscription = body<Subscription>(response);

    expect(subscription).toMatchObject({ plan: 'FREE', status: 'ACTIVE', invoiceQuota: 10, invoicesUsed: 0 });
  });

  it('refuses a checkout for FREE — there is nothing to pay for', async () => {
    await request(server)
      .post('/api/billing/checkout')
      .set('Cookie', cookie)
      .send({ plan: 'FREE' })
      .expect(400);
  });

  it('upgrades the plan through the sandbox checkout, which settles immediately', async () => {
    const checkout = await request(server)
      .post('/api/billing/checkout')
      .set('Cookie', cookie)
      .send({ plan: 'STARTER' })
      .expect(201);

    expect(body<{ checkoutUrl: string }>(checkout).checkoutUrl).toContain('/billing/sandbox?payment=');

    const subscription = await request(server)
      .get('/api/billing/subscription')
      .set('Cookie', cookie)
      .expect(200);
    expect(body<Subscription>(subscription)).toMatchObject({
      plan: 'STARTER',
      status: 'ACTIVE',
      invoiceQuota: 100,
    });

    const payment = await prisma.payment.findFirstOrThrow();
    expect(payment.status).toBe('PAID');
    expect(payment.paidAt).not.toBeNull();
  });

  describe('the callback', () => {
    it('is idempotent: a retried delivery does not extend the period again', async () => {
      // The sandbox checkout already settles the payment immediately, so this
      // callback is the retried delivery — the useful one to assert on.
      await request(server)
        .post('/api/billing/checkout')
        .set('Cookie', cookie)
        .send({ plan: 'STARTER' })
        .expect(201);
      const payment = await prisma.payment.findFirstOrThrow();
      const before = await prisma.subscription.findUniqueOrThrow({ where: { companyId: payment.companyId } });

      await request(server)
        .post('/api/billing/callback')
        .set('Content-Type', 'application/json')
        .send(
          JSON.stringify({
            referenceId: payment.id,
            externalId: payment.maibPayId,
            state: 'PAID',
            amount: '249.00',
            currency: 'MDL',
          }),
        )
        .expect(200);

      const after = await prisma.subscription.findUniqueOrThrow({ where: { companyId: payment.companyId } });
      // If the idempotency guard had not caught the retry, this would have
      // reset the period again to a later `currentPeriodEnd`.
      expect(after.currentPeriodEnd).toEqual(before.currentPeriodEnd);
    });

    it('does not extend the subscription when the amount does not match the plan', async () => {
      await request(server)
        .post('/api/billing/checkout')
        .set('Cookie', cookie)
        .send({ plan: 'STARTER' })
        .expect(201);
      const payment = await prisma.payment.findFirstOrThrow();

      // Simulate a second, distinct payment for the same company so the
      // mismatch is exercised on a callback the immediate checkout check has
      // not already settled.
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'PENDING', paidAt: null } });

      await request(server)
        .post('/api/billing/callback')
        .set('Content-Type', 'application/json')
        .send(
          JSON.stringify({
            referenceId: payment.id,
            externalId: payment.maibPayId,
            state: 'PAID',
            amount: '1.00',
            currency: 'MDL',
          }),
        )
        .expect(200);

      const untouched = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(untouched.status).toBe('PENDING');
    });
  });

  describe('the monthly quota', () => {
    it('refuses to sign a document once the plan quota is spent', async () => {
      const partner = await request(server)
        .post('/api/counterparties')
        .set('Cookie', cookie)
        .send(PARTNER)
        .expect(201);
      const counterpartyId = body<{ id: string }>(partner).id;
      const draft = {
        issueDate: today(),
        counterpartyId,
        lines: [{ name: 'Consultanță', quantity: '1', priceNet: '10.00', vatRate: '20' }],
      };

      for (let index = 0; index < 10; index += 1) {
        const created = await request(server)
          .post('/api/invoices')
          .set('Cookie', cookie)
          .send(draft)
          .expect(201);
        await request(server)
          .post(`/api/invoices/${body<{ id: string }>(created).id}/submit`)
          .set('Cookie', cookie)
          .expect(200);
      }

      const eleventh = await request(server)
        .post('/api/invoices')
        .set('Cookie', cookie)
        .send(draft)
        .expect(201);
      const response = await request(server)
        .post(`/api/invoices/${body<{ id: string }>(eleventh).id}/submit`)
        .set('Cookie', cookie)
        .expect(403);

      expect(body<{ code: string }>(response).code).toBe('quota_exceeded');
    });
  });
});
