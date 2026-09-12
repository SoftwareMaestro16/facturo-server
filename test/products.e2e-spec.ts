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

const PRODUCT = {
  code: 'SRV-001',
  name: 'Consultanță IT',
  unit: 'HUR',
  priceNet: '1250.00',
  vatRate: '20',
};

describe('products', () => {
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

  describe('creating', () => {
    it('stores the product and keeps money as a fixed-scale string', async () => {
      const response = await request(server)
        .post('/api/products')
        .set('Cookie', cookie)
        .send(PRODUCT)
        .expect(201);

      // 1250 through JSON would drop the trailing zeroes; a fixed string does not.
      expect(body(response)).toMatchObject({
        name: PRODUCT.name,
        priceNet: '1250.00',
        vatRate: '20.00',
        isArchived: false,
      });
    });

    it('refuses a price with a third decimal', async () => {
      await request(server)
        .post('/api/products')
        .set('Cookie', cookie)
        .send({ ...PRODUCT, priceNet: '10.005' })
        .expect(400);
    });

    it('refuses a VAT rate that is not on the platform list', async () => {
      await request(server)
        .post('/api/products')
        .set('Cookie', cookie)
        .send({ ...PRODUCT, vatRate: '17' })
        .expect(400);
    });

    it('refuses a duplicate product code inside one company', async () => {
      await request(server).post('/api/products').set('Cookie', cookie).send(PRODUCT).expect(201);
      const clash = await request(server)
        .post('/api/products')
        .set('Cookie', cookie)
        .send({ ...PRODUCT, name: 'Altul' })
        .expect(409);

      expect(body<{ code: string }>(clash).code).toBe('product_code_exists');
    });
  });

  describe('listing', () => {
    it('hides archived rows by default and shows them when asked', async () => {
      const created = await request(server)
        .post('/api/products')
        .set('Cookie', cookie)
        .send(PRODUCT)
        .expect(201);
      const { id } = body<{ id: string }>(created);

      await request(server).delete(`/api/products/${id}`).set('Cookie', cookie).expect(200);

      const hidden = await request(server).get('/api/products').set('Cookie', cookie).expect(200);
      expect(body<{ items: unknown[] }>(hidden).items).toHaveLength(0);

      const shown = await request(server)
        .get('/api/products?includeArchived=true')
        .set('Cookie', cookie)
        .expect(200);
      expect(body<{ items: unknown[] }>(shown).items).toHaveLength(1);
    });
  });
});
