import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../src/common/prisma/prisma.service';

import { body, cookiesOf, createTestApp, readCookie, resetDatabase } from './helpers/app';

const COMPANY_A = {
  companyName: 'SRL Alfa',
  idno: '1003600000001',
  vatCode: '000001',
  email: 'a@exemplu.md',
  fullName: 'Ana Alfa',
  password: 'parola-buna-2026',
};

const COMPANY_B = {
  companyName: 'SRL Beta',
  idno: '1003600000002',
  vatCode: '000002',
  email: 'b@exemplu.md',
  fullName: 'Boris Beta',
  password: 'parola-buna-2026',
};

const PARTNER = {
  name: 'SRL Partener',
  idno: '1009600054321',
  vatCode: '123456',
  email: 'partner@exemplu.md',
  phone: '+373 69 123 456',
  address: 'str. Ștefan cel Mare 1, Chișinău',
  iban: 'MD24AG000225100013104168',
  bankName: 'Moldova Agroindbank',
};

async function signIn(server: Server, credentials: typeof COMPANY_A): Promise<string> {
  const response = await request(server).post('/api/auth/register').send(credentials).expect(201);
  const cookie = readCookie(cookiesOf(response), 'access_token');

  if (!cookie) {
    throw new Error('access cookie missing from registration response');
  }

  return cookie;
}

describe('counterparties', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;
  let ownerA: string;
  let ownerB: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    ownerA = await signIn(server, COMPANY_A);
    ownerB = await signIn(server, COMPANY_B);
  });

  describe('creating', () => {
    it('stores the counterparty and infers the VAT flag from the code', async () => {
      const response = await request(server)
        .post('/api/counterparties')
        .set('Cookie', ownerA)
        .send(PARTNER)
        .expect(201);

      expect(body(response)).toMatchObject({ name: PARTNER.name, isVatPayer: true, isArchived: false });
    });

    it('refuses a malformed IDNO instead of storing it', async () => {
      await request(server)
        .post('/api/counterparties')
        .set('Cookie', ownerA)
        .send({ ...PARTNER, idno: '123' })
        .expect(400);
    });

    it('refuses a duplicate IDNO inside one company', async () => {
      await request(server).post('/api/counterparties').set('Cookie', ownerA).send(PARTNER).expect(201);
      const clash = await request(server)
        .post('/api/counterparties')
        .set('Cookie', ownerA)
        .send(PARTNER)
        .expect(409);

      expect(body<{ code: string }>(clash).code).toBe('counterparty_exists');
    });

    it('lets a second company reuse the same IDNO', async () => {
      // Two companies may each have the same partner. Uniqueness is per tenant.
      await request(server).post('/api/counterparties').set('Cookie', ownerA).send(PARTNER).expect(201);
      await request(server).post('/api/counterparties').set('Cookie', ownerB).send(PARTNER).expect(201);
    });
  });

  describe('tenancy', () => {
    it('returns only the counterparties of the caller company', async () => {
      await request(server).post('/api/counterparties').set('Cookie', ownerA).send(PARTNER).expect(201);
      await request(server)
        .post('/api/counterparties')
        .set('Cookie', ownerB)
        .send({ ...PARTNER, name: 'Altul', idno: '1009600054322' })
        .expect(201);

      const asA = await request(server).get('/api/counterparties').set('Cookie', ownerA).expect(200);
      const listA = body<{ items: unknown[] }>(asA).items;

      expect(listA).toHaveLength(1);
    });

    it('refuses to read another company row, and does not admit it exists', async () => {
      const created = await request(server)
        .post('/api/counterparties')
        .set('Cookie', ownerB)
        .send(PARTNER)
        .expect(201);
      const { id } = body<{ id: string }>(created);

      // Same response as an unknown id: nothing tells the caller that this id
      // belongs to another company.
      await request(server).get(`/api/counterparties/${id}`).set('Cookie', ownerA).expect(404);
      await request(server).get('/api/counterparties/unknown').set('Cookie', ownerA).expect(404);
    });

    it('refuses to update another company row', async () => {
      const created = await request(server)
        .post('/api/counterparties')
        .set('Cookie', ownerB)
        .send(PARTNER)
        .expect(201);
      const { id } = body<{ id: string }>(created);

      await request(server)
        .patch(`/api/counterparties/${id}`)
        .set('Cookie', ownerA)
        .send({ name: 'Hijacked' })
        .expect(404);

      const untouched = await prisma.counterparty.findUniqueOrThrow({ where: { id } });
      expect(untouched.name).toBe(PARTNER.name);
    });
  });

  describe('search and pagination', () => {
    beforeEach(async () => {
      for (let idx = 0; idx < 5; idx += 1) {
        await request(server)
          .post('/api/counterparties')
          .set('Cookie', ownerA)
          .send({
            ...PARTNER,
            name: `Partener ${idx}`,
            idno: `100960005432${idx}`,
          })
          .expect(201);
      }
    });

    it('caps the page and reports the total', async () => {
      const response = await request(server)
        .get('/api/counterparties?page=1&pageSize=2')
        .set('Cookie', ownerA)
        .expect(200);
      const page = body<{ items: unknown[]; meta: { total: number; totalPages: number } }>(response);

      expect(page.items).toHaveLength(2);
      expect(page.meta).toMatchObject({ total: 5, totalPages: 3 });
    });

    it('narrows by a case-insensitive name match', async () => {
      const response = await request(server)
        .get('/api/counterparties?search=partener%203')
        .set('Cookie', ownerA)
        .expect(200);
      const page = body<{ items: Array<{ name: string }> }>(response);

      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.name).toBe('Partener 3');
    });
  });

  describe('archiving', () => {
    it('sends the row to the bottom of the list, not to nothing', async () => {
      const created = await request(server)
        .post('/api/counterparties')
        .set('Cookie', ownerA)
        .send(PARTNER)
        .expect(201);
      const { id } = body<{ id: string }>(created);

      await request(server).delete(`/api/counterparties/${id}`).set('Cookie', ownerA).expect(200);

      const response = await request(server).get('/api/counterparties').set('Cookie', ownerA).expect(200);
      const items = body<{ items: Array<{ id: string; isArchived: boolean }> }>(response).items;
      const archived = items.find((entry) => entry.id === id);

      expect(archived?.isArchived).toBe(true);
    });
  });

  describe('validation gate', () => {
    it('rejects a field nobody declared instead of ignoring it', async () => {
      await request(server)
        .post('/api/counterparties')
        .set('Cookie', ownerA)
        .send({ ...PARTNER, companyId: 'other-company' })
        .expect(400);
    });
  });
});
