/// Parsing the token lifetimes out of configuration.
///
/// The same value has to drive two things that must never disagree: how long
/// the JWT is valid, and how long the cookie carrying it lives. A cookie that
/// outlives its token logs the customer out mid-form with no explanation; a
/// token that outlives its cookie keeps a credential alive after the browser
/// thinks it is gone.

const UNITS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
};

/// Accepts the shorthand used by jsonwebtoken ("15m", "30d") and returns
/// seconds. Refuses anything else rather than guessing: a silently wrong
/// lifetime is worse than a boot that fails.
export function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());

  if (!match) {
    throw new Error(`Unsupported duration: "${value}". Use a form like "15m" or "30d".`);
  }

  return Number(match[1]) * (UNITS[match[2] as string] as number);
}

export function durationToMilliseconds(value: string): number {
  return durationToSeconds(value) * 1000;
}
