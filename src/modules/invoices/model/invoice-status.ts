/// The status machine for a document. Kept here, away from NestJS, so the rules
/// can be read and tested as rules rather than inferred from service code.

/// Declared here rather than imported from the generated Prisma client, so the
/// rules stay testable without a database and the linter can keep model/ free
/// of framework imports. The values mirror the InvoiceStatus enum in the schema;
/// the service assigns between the two and the compiler checks the match.
export type InvoiceStatus =
  'DRAFT' | 'SIGNING' | 'SENT' | 'DELIVERED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'ERROR';

const ALLOWED: Readonly<Record<InvoiceStatus, readonly InvoiceStatus[]>> = {
  DRAFT: ['SIGNING', 'CANCELLED'],
  SIGNING: ['SENT', 'ERROR', 'DRAFT'],
  SENT: ['DELIVERED', 'REJECTED', 'ERROR', 'CANCELLED'],
  DELIVERED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: [],
  REJECTED: ['DRAFT'],
  CANCELLED: [],
  // A failed submission returns to the draft the customer can fix, or retries.
  ERROR: ['DRAFT', 'SIGNING'],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return ALLOWED[from].includes(to);
}

/// Only a draft may be edited. Once a document is handed to the platform it is
/// a legal record, and a correction is a new document, not an edit.
export function isEditable(status: InvoiceStatus): boolean {
  return status === 'DRAFT';
}

export function isTerminal(status: InvoiceStatus): boolean {
  return ALLOWED[status].length === 0;
}
