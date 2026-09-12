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

function daysFromNow(offset: number): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offset);

  return now.toISOString().slice(0, 10);
}

describe('invoices', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;
  let cookie: string;
  let counterpartyId: string;

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

    const partner = await request(server)
      .post('/api/counterparties')
      .set('Cookie', cookie)
      .send(PARTNER)
      .expect(201);
    counterpartyId = body<{ id: string }>(partner).id;
  });

  const draft = (overrides: Record<string, unknown> = {}) => ({
    issueDate: today(),
    counterpartyId,
    lines: [{ name: 'Consultanță', quantity: '2.500', priceNet: '100.00', vatRate: '20' }],
    ...overrides,
  });

  describe('creating a draft', () => {
    it('computes totals from the lines and stores them as strings', async () => {
      const response = await request(server)
        .post('/api/invoices')
        .set('Cookie', cookie)
        .send(draft())
        .expect(201);
      const invoice = body<{
        subtotal: string;
        vatTotal: string;
        total: string;
        status: string;
        series: string;
        number: number;
      }>(response);

      // 2.5 * 100 = 250; 20% VAT = 50; total = 300.
      expect(invoice.subtotal).toBe('250.00');
      expect(invoice.vatTotal).toBe('50.00');
      expect(invoice.total).toBe('300.00');
      expect(invoice.status).toBe('DRAFT');
      expect(invoice.series).toBe('FAC');
      expect(invoice.number).toBe(1);
    });

    it('copies the counterparty snapshot onto the document', async () => {
      const response = await request(server)
        .post('/api/invoices')
        .set('Cookie', cookie)
        .send(draft())
        .expect(201);
      const invoice = body<{ counterpartyName: string; counterpartyIdno: string }>(response);

      expect(invoice.counterpartyName).toBe(PARTNER.name);
      expect(invoice.counterpartyIdno).toBe(PARTNER.idno);
    });

    it('hands out consecutive numbers from the default series', async () => {
      await request(server).post('/api/invoices').set('Cookie', cookie).send(draft()).expect(201);
      const second = await request(server)
        .post('/api/invoices')
        .set('Cookie', cookie)
        .send(draft())
        .expect(201);

      expect(body<{ number: number }>(second).number).toBe(2);
    });

    it('refuses an issue date already in the past', async () => {
      const response = await request(server)
        .post('/api/invoices')
        .set('Cookie', cookie)
        .send(draft({ issueDate: daysFromNow(-1) }))
        .expect(400);

      expect(body<{ code: string }>(response).code).toBe('efactura_issue_date_in_past');
    });

    it('refuses an issue date more than ten days ahead', async () => {
      const response = await request(server)
        .post('/api/invoices')
        .set('Cookie', cookie)
        .send(draft({ issueDate: daysFromNow(11) }))
        .expect(400);

      expect(body<{ code: string }>(response).code).toBe('efactura_issue_date_too_far_ahead');
    });

    it('refuses a counterparty that belongs to another company', async () => {
      // Second company, its own partner.
      const other = { ...OWNER, email: 'b@exemplu.md', idno: '1003600000002', vatCode: '000002' };
      const otherReg = await request(server).post('/api/auth/register').send(other).expect(201);
      const otherCookie = readCookie(cookiesOf(otherReg), 'access_token') ?? '';
      const otherPartner = await request(server)
        .post('/api/counterparties')
        .set('Cookie', otherCookie)
        .send({ ...PARTNER, idno: '1009600054999' })
        .expect(201);
      const otherId = body<{ id: string }>(otherPartner).id;

      const response = await request(server)
        .post('/api/invoices')
        .set('Cookie', cookie)
        .send(draft({ counterpartyId: otherId }))
        .expect(400);

      expect(body<{ code: string }>(response).code).toBe('counterparty_not_found');
    });
  });

  describe('preview', () => {
    it('returns totals for a set of lines without saving anything', async () => {
      const response = await request(server)
        .post('/api/invoices/preview')
        .set('Cookie', cookie)
        .send({
          lines: [
            { name: 'A', quantity: '1', priceNet: '100.00', vatRate: '20' },
            { name: 'B', quantity: '3', priceNet: '33.33', vatRate: '20' },
          ],
        })
        .expect(200);
      const preview = body<{ subtotal: string; total: string }>(response);

      expect(preview.subtotal).toBe('199.99');
      expect(preview.total).toBe('239.99');
      expect(await prisma.invoice.count()).toBe(0);
    });
  });

  describe('editing a draft', () => {
    it('replaces the lines and recomputes totals', async () => {
      const created = await request(server)
        .post('/api/invoices')
        .set('Cookie', cookie)
        .send(draft())
        .expect(201);
      const { id } = body<{ id: string }>(created);

      const updated = await request(server)
        .patch(`/api/invoices/${id}`)
        .set('Cookie', cookie)
        .send({
          lines: [{ name: 'Nou', quantity: '1', priceNet: '500.00', vatRate: '20' }],
        })
        .expect(200);

      expect(body<{ total: string; lines: unknown[] }>(updated).total).toBe('600.00');
      expect(body<{ lines: unknown[] }>(updated).lines).toHaveLength(1);
    });

    it('refuses to edit anything past DRAFT', async () => {
      const created = await request(server)
        .post('/api/invoices')
        .set('Cookie', cookie)
        .send(draft())
        .expect(201);
      const { id } = body<{ id: string }>(created);

      // Move it out of DRAFT by hand; phase 2 will do this through the API.
      await prisma.invoice.update({ where: { id }, data: { status: 'SIGNED' } });

      const response = await request(server)
        .patch(`/api/invoices/${id}`)
        .set('Cookie', cookie)
        .send({ notes: 'try to edit' })
        .expect(409);

      expect(body<{ code: string }>(response).code).toBe('invoice_not_editable');
    });
  });

  describe('deleting a draft', () => {
    it('removes a draft outright', async () => {
      const created = await request(server)
        .post('/api/invoices')
        .set('Cookie', cookie)
        .send(draft())
        .expect(201);
      const { id } = body<{ id: string }>(created);

      await request(server).delete(`/api/invoices/${id}`).set('Cookie', cookie).expect(204);
      expect(await prisma.invoice.count()).toBe(0);
    });

    it('refuses to delete a document that has left DRAFT', async () => {
      const created = await request(server)
        .post('/api/invoices')
        .set('Cookie', cookie)
        .send(draft())
        .expect(201);
      const { id } = body<{ id: string }>(created);

      await prisma.invoice.update({ where: { id }, data: { status: 'SIGNED' } });

      const response = await request(server).delete(`/api/invoices/${id}`).set('Cookie', cookie).expect(409);
      expect(body<{ code: string }>(response).code).toBe('invoice_not_draft');
    });
  });

  describe('listing', () => {
    it('filters by direction and status', async () => {
      await request(server).post('/api/invoices').set('Cookie', cookie).send(draft()).expect(201);

      const outgoing = await request(server)
        .get('/api/invoices?direction=OUTGOING&status=DRAFT')
        .set('Cookie', cookie)
        .expect(200);
      expect(body<{ items: unknown[] }>(outgoing).items).toHaveLength(1);

      const incoming = await request(server)
        .get('/api/invoices?direction=INCOMING')
        .set('Cookie', cookie)
        .expect(200);
      expect(body<{ items: unknown[] }>(incoming).items).toHaveLength(0);
    });
  });
});
