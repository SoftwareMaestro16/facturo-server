import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';

import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
}

/// Builds the application the same way main.ts does, minus the parts that only
/// matter in production. A test that configures the pipe differently from the
/// real boot is testing something nobody ships.
///
/// Deliberately absent: the rate limiters main.ts mounts on /api and on the
/// auth routes. With them on, the lockout test would be answered 429 by the
/// limiter before the account ever locked, and it is the lockout that is under
/// test here. The limiters are a separate concern with their own configuration.
export async function createTestApp(): Promise<TestApp> {
  assertTestDatabase();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });

  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  await app.init();

  return { app, prisma: app.get(PrismaService) };
}

/// Order matters: children before parents, or the foreign keys refuse.
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  assertTestDatabase();
  await prisma.auditEvent.deleteMany();
  await prisma.session.deleteMany();
  await prisma.efacturaSubmission.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.numberSeries.deleteMany();
  await prisma.product.deleteMany();
  await prisma.counterparty.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
}

function assertTestDatabase(): void {
  const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid/invalid');
  if (
    process.env.NODE_ENV !== 'test' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.pathname !== '/facturo_test'
  ) {
    throw new Error(
      'E2E requires NODE_ENV=test and a local facturo_test database; refusing destructive cleanup',
    );
  }
}

/// Pulls one cookie out of a Set-Cookie header list.
export function readCookie(headers: string[] | undefined, name: string): string | undefined {
  return headers?.find((header) => header.startsWith(`${name}=`));
}

export function cookieValue(cookie: string | undefined): string | undefined {
  const value = cookie?.split(';')[0]?.split('=')[1];

  return value === '' ? undefined : value;
}

/// supertest types a response body as `any`, which would spread `any` through
/// every assertion. Casting once here keeps the rest of the suite typed.
export function body<T = Record<string, unknown>>(response: { body: unknown }): T {
  return response.body as T;
}

/// Same reason: Set-Cookie is typed loosely by the supertest types.
export function cookiesOf(response: { headers: Record<string, unknown> }): string[] {
  const raw = response.headers['set-cookie'];

  return Array.isArray(raw) ? (raw as string[]) : [];
}
