import type { InvoiceStatus } from './invoice-status';

/// Rules for a document the company received, not issued.
///
/// A freshly synced incoming document starts at RECEIVED — "Recepționată",
/// the platform's own word for "the buyer has taken delivery in the system".
/// From there the buyer either signs it (accepting, via the platform's own
/// SIGN action) or disputes it locally. There is no third option once it has
/// moved: a finished or cancelled document is a closed record.

export function canAcceptIncoming(status: InvoiceStatus): boolean {
  return status === 'RECEIVED';
}

/// Disputing is Facturo-only bookkeeping, not a platform action — see the
/// comment on Invoice.disputedAt. It is only meaningful once, on a document
/// still waiting for a decision.
export function canRejectIncoming(status: InvoiceStatus, disputedAt: Date | null): boolean {
  return status === 'RECEIVED' && disputedAt === null;
}
