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

describe('incoming invoices', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;
  let cookie: string;
  let companyId: string;

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
    companyId = (await prisma.company.findFirstOrThrow()).id;
  });

  it('has nothing to sync in the sandbox — there is no live e-Factura connection yet', async () => {
    const response = await request(server)
      .post('/api/invoices/incoming/sync')
      .set('Cookie', cookie)
      .expect(200);

    expect(body<{ created: number }>(response)).toEqual({ created: 0 });
  });

  describe('reviewing a document already received', () => {
    async function seedIncoming(): Promise<string> {
      const invoice = await prisma.invoice.create({
        data: {
          companyId,
          direction: 'INCOMING',
          status: 'RECEIVED',
          cycle: 'LONG',
          series: 'IN',
          number: 1,
          issueDate: new Date(),
          counterpartyName: 'Furnizor SRL',
          counterpartyIdno: '1009600054321',
          currency: 'MDL',
          total: '100.00',
          efacturaId: 'SFS-INCOMING-1',
        },
      });

      return invoice.id;
    }

    it('lets the buyer dispute it locally, with a reason', async () => {
      const id = await seedIncoming();

      await request(server)
        .post(`/api/invoices/${id}/reject`)
        .set('Cookie', cookie)
        .send({ reason: 'Nu recunoaștem această comandă' })
        .expect(204);

      const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id } });
      expect(invoice.disputedAt).not.toBeNull();
      expect(invoice.statusReason).toBe('Nu recunoaștem această comandă');
      // Disputing is Facturo-only bookkeeping — the platform status is
      // untouched, per the comment on Invoice.disputedAt.
      expect(invoice.status).toBe('RECEIVED');
    });

    it('refuses to dispute the same document twice', async () => {
      const id = await seedIncoming();

      await request(server)
        .post(`/api/invoices/${id}/reject`)
        .set('Cookie', cookie)
        .send({ reason: 'First look' })
        .expect(204);

      const second = await request(server)
        .post(`/api/invoices/${id}/reject`)
        .set('Cookie', cookie)
        .send({ reason: 'Second look' })
        .expect(409);

      expect(body<{ code: string }>(second).code).toBe('invoice_not_rejectable');
    });

    it('requires a reason to dispute a document', async () => {
      const id = await seedIncoming();

      await request(server).post(`/api/invoices/${id}/reject`).set('Cookie', cookie).send({}).expect(400);
    });

    it('refuses to accept or dispute a document belonging to another company', async () => {
      const id = await seedIncoming();
      const otherCompany = await prisma.company.create({
        data: { name: 'Alta companie', idno: '1009600099999' },
      });
      await prisma.invoice.update({ where: { id }, data: { companyId: otherCompany.id } });

      await request(server).post(`/api/invoices/${id}/accept`).set('Cookie', cookie).expect(404);
      await request(server)
        .post(`/api/invoices/${id}/reject`)
        .set('Cookie', cookie)
        .send({ reason: 'x' })
        .expect(404);
    });

    it('refuses to treat an outgoing document as one received', async () => {
      const outgoing = await prisma.invoice.create({
        data: {
          companyId,
          direction: 'OUTGOING',
          status: 'DRAFT',
          cycle: 'LONG',
          series: 'FAC',
          number: 999,
          issueDate: new Date(),
          counterpartyName: 'Cineva',
          counterpartyIdno: '1009600054321',
          currency: 'MDL',
        },
      });

      const response = await request(server)
        .post(`/api/invoices/${outgoing.id}/accept`)
        .set('Cookie', cookie)
        .expect(404);

      expect(body<{ code: string }>(response).code).toBe('invoice_not_found');
    });
  });
});
