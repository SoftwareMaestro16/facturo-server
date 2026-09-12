/// Money helpers working on integer minor units (bani). Floating point never
/// touches a total: 0.1 + 0.2 is a rounding bug waiting for an audit.

const MINOR_UNITS = 100;

export function toMinor(amount: string | number): number {
  return Math.round(Number(amount) * MINOR_UNITS);
}

export function fromMinor(minor: number): string {
  return (minor / MINOR_UNITS).toFixed(2);
}

/// Half-up, which is what Moldovan invoicing practice and the e-Factura
/// validator both expect. JavaScript's Math.round already rounds half up for
/// positive values; the explicit branch keeps negatives (credit notes) correct.
export function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}
