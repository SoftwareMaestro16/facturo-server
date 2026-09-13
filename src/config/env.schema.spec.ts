import { describe, expect, it } from 'vitest';

import { validateEnv } from './env.schema';

const base = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@host:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  CORS_ORIGINS: 'https://facturo.md',
};

describe('LAUNCH_PHASE=beta (default)', () => {
  it('boots when every provider stays in sandbox', () => {
    expect(() => validateEnv({ ...base })).not.toThrow();
  });

  it.each(['EFACTURA_PROVIDER', 'MAIB_PROVIDER', 'AI_PROVIDER'] as const)(
    'refuses a real %s before the beta checklist is done',
    (key) => {
      const real = { EFACTURA_PROVIDER: 'sfs', MAIB_PROVIDER: 'maib', AI_PROVIDER: 'openai' }[key];
      expect(() => validateEnv({ ...base, [key]: real })).toThrow(/LAUNCH_PHASE=beta/);
    },
  );
});

describe('LAUNCH_PHASE=commercial', () => {
  const commercial = { ...base, LAUNCH_PHASE: 'commercial' };

  it('refuses the sandbox e-Factura provider', () => {
    expect(() => validateEnv({ ...commercial, EFACTURA_PROVIDER: 'sandbox' })).toThrow(
      /requires the real e-Factura provider/,
    );
  });

  it('boots with the real e-Factura provider', () => {
    expect(() => validateEnv({ ...commercial, EFACTURA_PROVIDER: 'sfs' })).not.toThrow();
  });

  it('still requires OPENAI_API_KEY for AI_PROVIDER=openai', () => {
    expect(() => validateEnv({ ...commercial, EFACTURA_PROVIDER: 'sfs', AI_PROVIDER: 'openai' })).toThrow(
      /OPENAI_API_KEY/,
    );
  });
});
