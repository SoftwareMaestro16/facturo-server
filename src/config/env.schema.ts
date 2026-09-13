import { plainToInstance, Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MinLength, validateSync } from 'class-validator';

const toBoolean = () => Transform(({ value }) => value === 'true' || value === true);
const toInt = () => Transform(({ value }) => (value === undefined ? undefined : Number(value)));

export class EnvSchema {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @toInt()
  @IsInt()
  PORT = 3001;

  @IsString()
  CORS_ORIGINS = 'http://localhost:3000';

  @toBoolean()
  @IsBoolean()
  TRUST_PROXY = false;

  @IsString()
  DATABASE_URL!: string;

  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  JWT_ACCESS_TTL = '15m';

  @IsString()
  JWT_REFRESH_TTL = '30d';

  @IsString()
  COOKIE_DOMAIN = 'localhost';

  @IsOptional() @IsString() GOOGLE_CLIENT_ID?: string;
  /// Exchanges the one-time code from the sign-in popup. Never sent to a browser.
  @IsOptional() @IsString() GOOGLE_CLIENT_SECRET?: string;

  /// The interim launch strategy from docs/legal/risks-and-contacts.md: a free
  /// beta that never touches the tax service, a real bank account or a
  /// signed AI data-processing agreement, so the most expensive disputes
  /// cannot arise yet. Flip to "commercial" only once that checklist is done
  /// — it then requires the real e-Factura provider instead of forbidding it.
  @IsIn(['beta', 'commercial'])
  LAUNCH_PHASE: 'beta' | 'commercial' = 'beta';

  @IsIn(['sandbox', 'sfs'])
  EFACTURA_PROVIDER: 'sandbox' | 'sfs' = 'sandbox';

  @IsOptional() @IsString() EFACTURA_BASE_URL?: string;
  @IsOptional() @IsString() EFACTURA_CLIENT_ID?: string;
  @IsOptional() @IsString() EFACTURA_CLIENT_SECRET?: string;
  @IsOptional() @IsString() EFACTURA_SIGNING_CERT_PATH?: string;
  @IsOptional() @IsString() EFACTURA_SIGNING_CERT_PASSWORD?: string;

  @toInt() @IsInt() EFACTURA_POLL_INTERVAL_SECONDS = 300;

  @IsIn(['sandbox', 'maib'])
  MAIB_PROVIDER: 'sandbox' | 'maib' = 'sandbox';

  @IsOptional() @IsString() MAIB_BASE_URL?: string;
  @IsOptional() @IsString() MAIB_PROJECT_ID?: string;
  @IsOptional() @IsString() MAIB_PROJECT_SECRET?: string;
  @IsOptional() @IsString() MAIB_SIGNATURE_KEY?: string;
  @IsOptional() @IsString() MAIB_CALLBACK_URL?: string;
  @IsOptional() @IsString() MAIB_SUCCESS_URL?: string;
  @IsOptional() @IsString() MAIB_FAIL_URL?: string;

  /// "sandbox" answers from a local heuristic and sends nothing anywhere;
  /// "openai" calls the Responses API and needs OPENAI_API_KEY.
  @IsIn(['sandbox', 'openai'])
  AI_PROVIDER: 'sandbox' | 'openai' = 'sandbox';

  @IsOptional() @IsString() OPENAI_API_KEY?: string;
  @IsString() OPENAI_MODEL = 'gpt-5.6-luna';
  @toInt() @IsInt() OPENAI_TIMEOUT_MS = 20000;
  /// Calls per company per UTC day. Bounds both cost and the damage of a leaked session.
  @toInt() @IsInt() AI_DAILY_LIMIT = 30;

  @IsOptional() @IsString() SENTRY_DSN?: string;
  @IsString() LOG_LEVEL = 'debug';

  @toInt() @IsInt() THROTTLE_TTL_SECONDS = 60;
  @toInt() @IsInt() THROTTLE_LIMIT = 120;
  @toInt() @IsInt() AUTH_THROTTLE_LIMIT = 5;
}

/// Fails the boot rather than the first request. A placeholder secret reaching
/// production is cheaper to find here than six months later in signed tokens.
export function validateEnv(raw: Record<string, unknown>): EnvSchema {
  const parsed = plainToInstance(EnvSchema, raw, { enableImplicitConversion: false });
  const errors = validateSync(parsed, { skipMissingProperties: false, whitelist: false });

  if (errors.length > 0) {
    const details = errors.map((e) => `  ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`);
    throw new Error(`Invalid environment configuration:\n${details.join('\n')}`);
  }

  if (parsed.NODE_ENV === 'production') {
    assertProductionSafety(parsed);
  }

  return parsed;
}

function assertProductionSafety(env: EnvSchema): void {
  const placeholders = (['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const).filter((key) =>
    env[key].includes('change_me'),
  );

  if (placeholders.length > 0) {
    throw new Error(`Refusing to start: ${placeholders.join(', ')} still hold the example value.`);
  }

  if (env.CORS_ORIGINS.includes('*')) {
    throw new Error('Refusing to start: CORS_ORIGINS may not contain a wildcard when cookies are used.');
  }

  if (env.LAUNCH_PHASE === 'beta') {
    assertBetaPhaseBoundaries(env);
    return;
  }

  if (env.EFACTURA_PROVIDER === 'sandbox') {
    throw new Error('Refusing to start: LAUNCH_PHASE=commercial requires the real e-Factura provider.');
  }

  if (env.AI_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
    throw new Error('Refusing to start: AI_PROVIDER=openai needs OPENAI_API_KEY.');
  }
}

/// See docs/legal/risks-and-contacts.md: while there is no lawyer-reviewed
/// contract, no signed merchant agreement and no AI data-processing
/// agreement, production may only run the providers that never touch a real
/// tax authority, a real card or a real outside model.
function assertBetaPhaseBoundaries(env: EnvSchema): void {
  if (env.EFACTURA_PROVIDER !== 'sandbox') {
    throw new Error(
      'Refusing to start: LAUNCH_PHASE=beta only sends fiscal drafts through the sandbox e-Factura provider — see docs/legal/risks-and-contacts.md.',
    );
  }

  if (env.MAIB_PROVIDER !== 'sandbox') {
    throw new Error(
      'Refusing to start: LAUNCH_PHASE=beta does not take real card payments — see docs/legal/risks-and-contacts.md.',
    );
  }

  if (env.AI_PROVIDER !== 'sandbox') {
    throw new Error(
      'Refusing to start: LAUNCH_PHASE=beta keeps the AI assistant in sandbox until a data processing agreement is signed — see docs/legal/risks-and-contacts.md.',
    );
  }
}
