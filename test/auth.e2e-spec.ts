import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { PrismaService } from '../src/common/prisma/prisma.service';

import { body, cookiesOf, cookieValue, createTestApp, readCookie, resetDatabase } from './helpers/app';

const REGISTRATION = {
  companyName: 'SRL Exemplu',
  idno: '1003600012345',
  vatCode: '012345',
  email: 'Director@Exemplu.MD',
  phone: '+373 69 123 456',
  fullName: 'Ion Popescu',
  password: 'parola-buna-2026',
  locale: 'ro' as const,
};

describe('auth', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Server;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  const register = () => request(server).post('/api/auth/register').send(REGISTRATION);
  const login = (password = REGISTRATION.password) =>
    request(server).post('/api/auth/login').send({ email: REGISTRATION.email, password });

  describe('registration', () => {
    it('creates the company and its owner, and signs them in', async () => {
      const response = await register().expect(201);

      expect(body(response)).toMatchObject({
        companyName: 'SRL Exemplu',
        email: 'director@exemplu.md',
        role: 'OWNER',
        locale: 'ro',
      });

      const cookies = cookiesOf(response);
      expect(cookieValue(readCookie(cookies, 'access_token'))).toBeTruthy();
      expect(cookieValue(readCookie(cookies, 'refresh_token'))).toBeTruthy();
    });

    it('keeps the credentials out of JavaScript and off other sites', async () => {
      const response = await register().expect(201);
      const cookies = cookiesOf(response);

      for (const name of ['access_token', 'refresh_token']) {
        const cookie = readCookie(cookies, name) ?? '';
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('SameSite=Lax');
      }

      // The long-lived credential does not travel with every request.
      expect(readCookie(cookies, 'refresh_token')).toContain('Path=/api/auth');
    });

    it('gives the company a default invoice series so the first invoice has a number', async () => {
      await register().expect(201);

      const series = await prisma.numberSeries.findFirst();
      expect(series).toMatchObject({ series: 'FAC', isDefault: true, nextValue: 1 });
    });

    it('never stores the password itself', async () => {
      await register().expect(201);

      const user = await prisma.user.findFirstOrThrow();
      expect(user.passwordHash).not.toContain(REGISTRATION.password);
      expect(user.passwordHash.startsWith('$argon2')).toBe(true);
    });

    it('refuses a second account on the same email or the same company', async () => {
      await register().expect(201);

      await register().expect(409);
      await request(server)
        .post('/api/auth/register')
        .send({ ...REGISTRATION, email: 'other@exemplu.md' })
        .expect(409);
    });

    it('refuses a password that is the account phone number written differently', async () => {
      const response = await request(server)
        .post('/api/auth/register')
        .send({ ...REGISTRATION, password: '069123456' })
        .expect(400);

      expect(body<{ code: string }>(response).code).toBe('password_is_phone');
    });

    it('rejects a malformed IDNO rather than storing it', async () => {
      await request(server)
        .post('/api/auth/register')
        .send({ ...REGISTRATION, idno: '123' })
        .expect(400);
    });

    it('rejects a field nobody declared instead of ignoring it', async () => {
      await request(server)
        .post('/api/auth/register')
        .send({ ...REGISTRATION, role: 'OWNER' })
        .expect(400);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await register().expect(201);
    });

    it('accepts the address in any casing', async () => {
      const response = await login().expect(200);

      expect(body<{ email: string }>(response).email).toBe('director@exemplu.md');
    });

    it('answers identically for an unknown address and a wrong password', async () => {
      const unknown = await request(server)
        .post('/api/auth/login')
        .send({ email: 'nobody@exemplu.md', password: 'parola-buna-2026' })
        .expect(401);
      const wrong = await login('parola-gresita').expect(401);

      expect(body(unknown)).toMatchObject({ code: 'invalid_credentials' });
      expect(body(wrong)).toEqual(
        // Identical down to the message. A different sentence, or a different
        // timing, tells an attacker which addresses have accounts here.
        expect.objectContaining({
          code: 'invalid_credentials',
          message: body<{ message: string }>(unknown).message,
        }),
      );
    });

    it('locks the account after five failures, and says nothing different about it', async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await login('parola-gresita').expect(401);
      }

      const locked = await login().expect(401);
      expect(body<{ code: string }>(locked).code).toBe('invalid_credentials');

      const user = await prisma.user.findFirstOrThrow();
      expect(user.lockedUntil).not.toBeNull();
    });

    it('clears the failure count once the right password arrives', async () => {
      await login('parola-gresita').expect(401);
      await login().expect(200);

      const user = await prisma.user.findFirstOrThrow();
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lastLoginAt).not.toBeNull();
    });

    it('records both the failure and the success', async () => {
      await login('parola-gresita').expect(401);
      await login().expect(200);

      const types = (await prisma.auditEvent.findMany()).map((event) => event.type);
      expect(types).toContain('LOGIN_FAILURE');
      expect(types).toContain('LOGIN_SUCCESS');
    });
  });

  describe('refresh', () => {
    it('rotates the token and revokes the one that was presented', async () => {
      const first = await register().expect(201);
      const firstRefresh = readCookie(cookiesOf(first), 'refresh_token');

      const second = await request(server)
        .post('/api/auth/refresh')
        .set('Cookie', firstRefresh ?? '')
        .expect(204);

      const secondRefresh = readCookie(second.headers['set-cookie'] as unknown as string[], 'refresh_token');
      expect(cookieValue(secondRefresh)).not.toBe(cookieValue(firstRefresh));

      const sessions = await prisma.session.findMany({ orderBy: { createdAt: 'asc' } });
      expect(sessions).toHaveLength(2);
      expect(sessions[0]?.revokedAt).not.toBeNull();
      expect(sessions[0]?.replacedById).toBe(sessions[1]?.id);
    });

    it('kills every session when a token that was already rotated turns up again', async () => {
      const first = await register().expect(201);
      const stolen = readCookie(cookiesOf(first), 'refresh_token');

      await request(server)
        .post('/api/auth/refresh')
        .set('Cookie', stolen ?? '')
        .expect(204);

      // The same token a second time: either the holder kept a copy or someone
      // else has one. We cannot tell which, so nobody keeps their session.
      await request(server)
        .post('/api/auth/refresh')
        .set('Cookie', stolen ?? '')
        .expect(401);

      const live = await prisma.session.count({ where: { revokedAt: null } });
      expect(live).toBe(0);

      const reuse = await prisma.auditEvent.findFirst({ where: { type: 'SESSION_REVOKED' } });
      expect(reuse?.meta).toMatchObject({ reason: 'refresh_token_reuse' });
    });

    it('refuses a forged token and clears the dead cookies', async () => {
      const response = await request(server)
        .post('/api/auth/refresh')
        .set('Cookie', 'refresh_token=not-a-real-token')
        .expect(401);

      expect(body<{ code: string }>(response).code).toBe('invalid_refresh_token');
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('session', () => {
    it('refuses an unauthenticated caller without explaining why', async () => {
      await request(server).get('/api/auth/me').expect(401);
    });

    it('describes the signed-in user', async () => {
      const registered = await register().expect(201);
      const access = readCookie(cookiesOf(registered), 'access_token');

      const response = await request(server)
        .get('/api/auth/me')
        .set('Cookie', access ?? '')
        .expect(200);
      expect(body(response)).toMatchObject({ email: 'director@exemplu.md', companyName: 'SRL Exemplu' });
    });

    it('logs out even when there is nothing to log out of', async () => {
      await request(server).post('/api/auth/logout').expect(204);
    });
  });

  describe('changing the password', () => {
    it('revokes every session, so every device signs in again', async () => {
      const registered = await register().expect(201);
      const cookies = cookiesOf(registered);

      await request(server)
        .post('/api/auth/change-password')
        .set('Cookie', readCookie(cookies, 'access_token') ?? '')
        .send({ currentPassword: REGISTRATION.password, newPassword: 'alta-parola-2026' })
        .expect(204);

      expect(await prisma.session.count({ where: { revokedAt: null } })).toBe(0);
      await login('alta-parola-2026').expect(200);
      await login().expect(401);
    });

    it('refuses to set the password that is already in use', async () => {
      const registered = await register().expect(201);
      const access = readCookie(cookiesOf(registered), 'access_token');

      const response = await request(server)
        .post('/api/auth/change-password')
        .set('Cookie', access ?? '')
        .send({ currentPassword: REGISTRATION.password, newPassword: REGISTRATION.password })
        .expect(400);

      expect(body<{ code: string }>(response).code).toBe('password_same_as_current');
    });

    it('refuses when the current password is wrong', async () => {
      const registered = await register().expect(201);
      const access = readCookie(cookiesOf(registered), 'access_token');

      await request(server)
        .post('/api/auth/change-password')
        .set('Cookie', access ?? '')
        .send({ currentPassword: 'parola-gresita', newPassword: 'alta-parola-2026' })
        .expect(401);
    });
  });
});
