/// IDNO — the 13-digit state registration number every Moldovan legal entity
/// carries. Validated at the boundary only: once a counterparty is stored, the
/// rest of the system trusts it.

const IDNO_LENGTH = 13;

export function isValidIdno(value: string): boolean {
  return new RegExp(`^\\d{${IDNO_LENGTH}}$`).test(value);
}

/// VAT registration codes issued by SFS are six digits.
export function isValidVatCode(value: string): boolean {
  return /^\d{6}$/.test(value);
}
