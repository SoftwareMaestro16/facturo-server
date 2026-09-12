/// Writes openapi.json without starting a server.
///
/// This file is the contract the client generates its entire data layer from:
/// `npm run openapi:export` here, then `npm run api:generate` in facturo-.
/// Nobody hand-writes a fetch call or a response type on the client.
import { writeFileSync } from 'node:fs';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from '../src/app.module';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Facturo API')
      .setDescription('e-Factura invoicing for Moldovan small and medium business')
      .setVersion('0.1.0')
      .addCookieAuth('access_token')
      .build(),
  );

  writeFileSync('openapi.json', JSON.stringify(document, null, 2));
  await app.close();
  process.stdout.write('openapi.json written\n');
}

void main();
