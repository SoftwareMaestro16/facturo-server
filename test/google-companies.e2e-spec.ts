import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import type { PrismaService } from '../src/common/prisma/prisma.service';
import { GoogleService } from '../src/modules/auth/google.service';
import { CURRENT_TERMS_VERSION } from '../src/modules/auth/model/terms';
import { body, cookiesOf, createTestApp, readCookie, resetDatabase } from './helpers/app';

describe('Google onboarding and company isolation', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;
  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    server = app.getHttpServer() as Server;
    // Only the exchange with Google is replaced. HTTP, cookies, auth and DB are real.
    vi.spyOn(app.get(GoogleService), 'exchangeCode').mockResolvedValue({
      subject: 'google-test',
      email: 'google-test@example.com',
      fullName: 'Test Owner',
    });
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  });
  const login = () =>
    request(server)
      .post('/api/auth/google')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ code: 'test-code', termsVersion: CURRENT_TERMS_VERSION });
  const access = (r: { headers: Record<string, unknown> }) => readCookie(cookiesOf(r), 'access_token') ?? '';

  it('refuses a sign-in request that did not come from our page', async () => {
    await request(server)
      .post('/api/auth/google')
      .send({ code: 'test-code', termsVersion: CURRENT_TERMS_VERSION })
      .expect(403);
    expect(await prisma.user.count()).toBe(0);
  });

  it('creates a company-less account, records the Terms and reuses the identity', async () => {
    const first = await login().expect(200);
    expect(body<{ companyId: string | null }>(first).companyId).toBeNull();
    await request(server).get('/api/companies').set('Cookie', access(first)).expect(200, []);
    const second = await login().expect(200);
    expect(body<{ userId: string }>(second).userId).toBe(body<{ userId: string }>(first).userId);
    expect(await prisma.user.count()).toBe(1);
    const stored = await prisma.user.findFirstOrThrow({
      select: { termsVersion: true, termsAcceptedAt: true },
    });
    expect(stored.termsVersion).toBe(CURRENT_TERMS_VERSION);
    expect(stored.termsAcceptedAt).toBeInstanceOf(Date);
  });

  it('creates two companies, switches context and refuses an unrelated company', async () => {
    const signedIn = await login().expect(200);
    const first = await request(server)
      .post('/api/companies')
      .set('Cookie', access(signedIn))
      .send({ companyName: 'First SRL', idno: '1003600000001' })
      .expect(201);
    const second = await request(server)
      .post('/api/companies')
      .set('Cookie', access(first))
      .send({ companyName: 'Second SRL', idno: '1003600000002' })
      .expect(201);
    const firstId = body<{ companyId: string }>(first).companyId;
    const list = await request(server).get('/api/companies').set('Cookie', access(second)).expect(200);
    expect(body<unknown[]>(list)).toHaveLength(2);
    const switched = await request(server)
      .post(`/api/companies/${firstId}/switch`)
      .set('Cookie', access(second))
      .expect(201);
    const current = await request(server)
      .get('/api/companies/me')
      .set('Cookie', access(switched))
      .expect(200);
    expect(body<{ id: string }>(current).id).toBe(firstId);
    await request(server)
      .post('/api/companies/foreign-company/switch')
      .set('Cookie', access(switched))
      .expect(403);
  });
});
