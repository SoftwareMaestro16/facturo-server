import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { TypedConfigService } from './typed-config.service';
import { validateEnv } from './env.schema';

/// Global, and it owns TypedConfigService.
///
/// Providing the typed wrapper from AppModule instead looks equivalent and is
/// not: a global module such as PrismaModule is resolved without AppModule's
/// own providers in scope, and injecting it there fails at boot.
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  providers: [TypedConfigService],
  exports: [TypedConfigService],
})
export class AppConfigModule {}
