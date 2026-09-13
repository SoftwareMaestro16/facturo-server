/// The edition of the Terms and the Privacy Policy shown next to the sign-in
/// button. Equal to the "updated" date printed on both documents, so the page a
/// person read and the acceptance stored in their account name the same text.
/// Change it together with the documents and the client's LEGAL_VERSION.
export const CURRENT_TERMS_VERSION = '2026-09-13';

export function isCurrentTermsVersion(version: unknown): version is string {
  return version === CURRENT_TERMS_VERSION;
}

/// The first acceptance of an edition is the one worth keeping; signing in
/// again under the same edition must not overwrite its date.
export function needsTermsRecord(stored: string | null | undefined): boolean {
  return stored !== CURRENT_TERMS_VERSION;
}
