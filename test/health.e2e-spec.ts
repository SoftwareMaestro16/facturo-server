import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { body, createTestApp } from './helpers/app';

describe('health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports the database as reachable', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/health')
      .expect(200);

    expect(body(response)).toMatchObject({ status: 'ok' });
  });
});
