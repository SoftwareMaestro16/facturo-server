/// Rules about the issue date of a fiscal invoice, as SIA "e-Factura" enforces
/// them.
///
/// Three rules, and each one costs the customer something different when it is
/// broken:
///
///   1. When the document is created, the issue date may be today or up to ten
///      calendar days ahead. Nothing earlier, nothing further out.
///   2. When an electronic signature is applied, the issue date must not be in
///      the past relative to the signing date. This holds for documents created
///      in the portal, uploaded as XML and sent through the API alike.
///   3. If the second signature lands on a day after the issue date, the
///      document can no longer be completed — the only thing left to do with it
///      is cancel it and issue a new one.
///
/// Rule 3 is the expensive one. A document drafted on Friday and signed off on
/// Monday is dead, and the customer finds out at the worst moment. Facturo warns
/// before that happens, which is the whole reason these rules live in code
/// rather than in someone's memory.
///
/// Dates are handled as calendar days in "YYYY-MM-DD" form, not as timestamps.
/// A fiscal date has no time of day, and comparing instants across a timezone
/// boundary is how a document ends up dated yesterday.

/// The furthest ahead a document may be dated when it is created.
export const MAX_DAYS_AHEAD = 10;

export type IssueDateViolation = 'issue_date_in_past' | 'issue_date_too_far_ahead';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDayNumber(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) / MS_PER_DAY;
}

function daysBetween(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from);
}

/// Checked when a draft is created or its date is edited.
export function validateIssueDate(issueDate: string, today: string): IssueDateViolation[] {
  const offset = daysBetween(today, issueDate);

  if (offset < 0) {
    return ['issue_date_in_past'];
  }

  if (offset > MAX_DAYS_AHEAD) {
    return ['issue_date_too_far_ahead'];
  }

  return [];
}

/// Checked immediately before a signature is applied, on every signature.
export function canSignOn(issueDate: string, signingDay: string): boolean {
  return daysBetween(signingDay, issueDate) >= 0;
}

/// True when applying the second signature on this day would leave the document
/// with no route to completion. The interface must say so before the customer
/// clicks, not after.
export function secondSignatureLeavesOnlyCancellation(issueDate: string, signingDay: string): boolean {
  return daysBetween(signingDay, issueDate) < 0;
}

/// How many days are left to sign a document dated this way. Zero means today is
/// the last day; a negative number means the window has already closed.
export function daysLeftToSign(issueDate: string, today: string): number {
  return daysBetween(today, issueDate);
}
