/// The boundary between Facturo and SIA "e-Factura".
///
/// Everything the rest of the application knows about the tax platform passes
/// through this interface. Two reasons it exists rather than calling the State
/// Tax Service directly from the invoice service:
///   - development and CI run against the sandbox implementation, with no
///     credentials, no certificate and no network;
///   - when the platform changes a field or a status name, exactly one file
///     changes.
///
/// The vocabulary here follows the platform, not a tidier scheme of our own.

/// Short cycle: final on the supplier's second signature, then printed and
/// handed over on paper. Long cycle: the buyer signs and it stays electronic.
export type EfacturaCycle = 'SHORT' | 'LONG';

export interface EfacturaDocument {
  /// Facturo's own invoice id, echoed back so a callback can be matched.
  referenceId: string;
  cycle: EfacturaCycle;
  /// Facturo's draft numbering. The fiscal series and number are assigned by
  /// the platform and come back in the submission result.
  draftSeries: string;
  draftNumber: number;
  /// Calendar day, "YYYY-MM-DD". Today or up to ten days ahead, never earlier.
  issueDate: string;
  deliveryDate?: string;
  supplier: EfacturaParty;
  buyer: EfacturaParty;
  /// Present when goods move. Rows 5 and 6 of the standard form are the first
  /// thing a tax inspection looks at for a goods invoice.
  transport?: EfacturaTransport;
  currency: string;
  lines: EfacturaLine[];
  subtotal: string;
  vatTotal: string;
  total: string;
  notes?: string;
}

export interface EfacturaParty {
  name: string;
  /// The 13-digit state registration number.
  idno: string;
  /// VAT registration code, six digits. Absent for a non-payer.
  vatCode?: string;
  address?: string;
  iban?: string;
  bankName?: string;
}

export interface EfacturaTransport {
  loadingPoint?: string;
  unloadingPoint?: string;
  transporterName?: string;
  transporterIdno?: string;
  vehicleNumber?: string;
  driverName?: string;
}

export interface EfacturaLine {
  position: number;
  name: string;
  /// Unit of measure per the national classifier.
  unit: string;
  quantity: string;
  priceNet: string;
  vatRate: string;
  amountNet: string;
  vatAmount: string;
  amountGross: string;
}

/// The states the platform itself reports. ERROR is ours: it means the exchange
/// failed, not that the document was refused.
export type EfacturaState =
  'SIGNED' | 'SENT' | 'RECEIVED' | 'FINISHED' | 'CANCELLATION_REQUESTED' | 'CANCELLED' | 'ERROR';

export interface SubmissionResult {
  externalId: string;
  state: EfacturaState;
  /// The fiscal series and number the platform assigned, once it has.
  assignedSeries?: string;
  assignedNumber?: string;
  /// The payload that was transmitted, stored verbatim as evidence.
  requestXml: string;
  responseRaw: string;
}

export interface DocumentStatus {
  externalId: string;
  state: EfacturaState;
  /// Present when a cancellation was requested or refused, in the other party's
  /// own words.
  reason?: string;
  changedAt: string;
}

export interface IncomingDocument {
  externalId: string;
  cycle: EfacturaCycle;
  supplier: EfacturaParty;
  series: string;
  number: string;
  issueDate: string;
  total: string;
  currency: string;
  rawXml: string;
}

/// What either party can do to a document that is already on the platform.
///
/// RECEIVE and SIGN are the buyer's steps in the long cycle. The three
/// cancellation actions exist because a finished long-cycle document carries the
/// buyer's signature: the supplier asks, the buyer agrees or refuses.
export type EfacturaAction =
  'RECEIVE' | 'SIGN' | 'REQUEST_CANCELLATION' | 'ACCEPT_CANCELLATION' | 'REJECT_CANCELLATION';

export interface EfacturaProvider {
  /// Signs and hands a document to the platform.
  submit(document: EfacturaDocument): Promise<SubmissionResult>;
  getStatus(externalId: string): Promise<DocumentStatus>;
  listIncoming(since: Date): Promise<IncomingDocument[]>;
  act(externalId: string, action: EfacturaAction, reason?: string): Promise<DocumentStatus>;
}

/// Injection token. Which implementation is bound is decided by
/// EFACTURA_PROVIDER, in efactura.module.ts, and nowhere else.
export const EFACTURA_PROVIDER = Symbol('EFACTURA_PROVIDER');
