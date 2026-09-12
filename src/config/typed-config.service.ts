import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvSchema } from './env.schema';

/// Thin wrapper so call sites read `config.get('JWT_ACCESS_TTL')` with the key
/// checked at compile time, instead of passing raw strings around.
@Injectable()
export class TypedConfigService {
  constructor(private readonly config: ConfigService<EnvSchema, true>) {}

  get<K extends keyof EnvSchema>(key: K): EnvSchema[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  get corsOrigins(): string[] {
    return this.get('CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
}
