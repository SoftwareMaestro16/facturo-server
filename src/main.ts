import './instrument';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { authLimiter, generalLimiter } from './common/rate-limit';
import { TypedConfigService } from './config/typed-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(TypedConfigService);

  // A pure JSON API serves no markup, so the content policy has nothing to guard.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cookieParser());
  app.use(compression({ threshold: 1024 }));

  if (config.get('TRUST_PROXY')) {
    // Without this the rate limiter sees nginx's address for every caller.
    app.set('trust proxy', 1);
  }

  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.setGlobalPrefix('api');

  app.use('/api', generalLimiter(config));
  app.use(['/api/auth/login', '/api/auth/register', '/api/auth/google'], authLimiter(config));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  if (!config.isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Facturo API')
        .setDescription('e-Factura invoicing for Moldovan small and medium business')
        .setVersion('0.1.0')
        .addCookieAuth('access_token')
        .build(),
    );

    // The client generates its entire data layer from this document.
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();

  const port = config.get('PORT');
  await app.listen(port);
  new Logger('Bootstrap').log(`Facturo API listening on port ${port}`);
}

void bootstrap();
