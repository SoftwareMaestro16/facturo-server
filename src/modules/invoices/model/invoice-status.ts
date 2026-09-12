/// The status machine for a fiscal document, following SIA "e-Factura".
///
/// The platform runs two lifecycles, and they end differently:
///
///   Short cycle ("ciclu scurt") — the document is final once the supplier
///   applies a second signature. The supplier then prints it, signs by hand and
///   hands the paper to the buyer.
///
///   Long cycle ("ciclu lung") — the buyer signs electronically and the document
///   never leaves the system. This is the one that matters once electronic
///   invoicing is mandatory, and Facturo defaults to it.
///
/// Both reach the same final state, "Finisată". What differs is whose signature
/// gets them there, which is why the transition table below is per cycle.

export type InvoiceCycle = 'SHORT' | 'LONG';

/// Declared here rather than imported from the generated Prisma client, so the
/// rules stay testable without a database and the linter can keep model/ free
/// of framework imports. The values mirror the InvoiceStatus enum in the schema.
export type InvoiceStatus =
  'DRAFT' | 'SIGNED' | 'SENT' | 'RECEIVED' | 'FINISHED' | 'CANCELLATION_REQUESTED' | 'CANCELLED' | 'ERROR';

type TransitionTable = Readonly<Record<InvoiceStatus, readonly InvoiceStatus[]>>;

const COMMON: TransitionTable = {
  DRAFT: ['SIGNED', 'ERROR', 'CANCELLED'],
  SIGNED: ['SENT', 'ERROR', 'CANCELLED'],
  SENT: ['RECEIVED', 'FINISHED', 'ERROR', 'CANCELLED'],
  RECEIVED: ['FINISHED', 'CANCELLED'],
  FINISHED: [],
  CANCELLATION_REQUESTED: ['CANCELLED', 'FINISHED'],
  CANCELLED: [],
  // A failed submission goes back to the draft the customer can fix, or is
  // retried from where it was.
  ERROR: ['DRAFT', 'SIGNED'],
};

/// A finished long-cycle document carries the buyer's signature, so the supplier
/// cannot simply withdraw it. Cancellation has to be asked for and accepted.
const LONG: TransitionTable = {
  ...COMMON,
  FINISHED: ['CANCELLATION_REQUESTED'],
};

/// In the short cycle the buyer never signed inside the system, so the supplier
/// may cancel a finished document directly.
const SHORT: TransitionTable = {
  ...COMMON,
  FINISHED: ['CANCELLED'],
  // There is nobody to ask, so this state does not occur.
  CANCELLATION_REQUESTED: [],
};

function tableFor(cycle: InvoiceCycle): TransitionTable {
  return cycle === 'LONG' ? LONG : SHORT;
}

export function canTransition(cycle: InvoiceCycle, from: InvoiceStatus, to: InvoiceStatus): boolean {
  return tableFor(cycle)[from].includes(to);
}

export function nextStatuses(cycle: InvoiceCycle, from: InvoiceStatus): readonly InvoiceStatus[] {
  return tableFor(cycle)[from];
}

/// Only a draft may be edited. Once a signature is applied the document is a
/// legal record, and a correction is a new document, not an edit.
export function isEditable(status: InvoiceStatus): boolean {
  return status === 'DRAFT';
}

export function isTerminal(cycle: InvoiceCycle, status: InvoiceStatus): boolean {
  return tableFor(cycle)[status].length === 0;
}

/// Whether the document counts against the company's monthly quota. A draft that
/// was never signed cost nothing and must not be billed for.
export function countsAgainstQuota(status: InvoiceStatus): boolean {
  return status !== 'DRAFT' && status !== 'ERROR';
}
