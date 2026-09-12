/// The boundary between Facturo and SIA "e-Factura".
///
/// Everything the rest of the application knows about the tax platform passes
/// through this interface. Two reasons it exists rather than calling SFS
/// directly from the invoice service:
///   - development and CI run against the sandbox implementation, with no
///     credentials, no certificate and no network;
///   - when SFS changes a field or a status name, exactly one file changes.

export interface EfacturaDocument {
  /// Facturo's own invoice id, echoed back so a callback can be matched.
  referenceId: string;
  series: string;
  number: number;
  issueDate: string;
  supplier: EfacturaParty;
  buyer: EfacturaParty;
  currency: string;
  lines: EfacturaLine[];
  subtotal: string;
  vatTotal: string;
  total: string;
  notes?: string;
}

export interface EfacturaParty {
  name: string;
  idno: string;
  vatCode?: string;
  address?: string;
  iban?: string;
  bankName?: string;
}

export interface EfacturaLine {
  position: number;
  name: string;
  unit: string;
  quantity: string;
  priceNet: string;
  vatRate: string;
  amountNet: string;
  vatAmount: string;
  amountGross: string;
}

export type EfacturaState = 'SENT' | 'DELIVERED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'ERROR';

export interface SubmissionResult {
  externalId: string;
  state: EfacturaState;
  /// The raw payload that was transmitted, stored as evidence.
  requestXml: string;
  responseRaw: string;
}

export interface DocumentStatus {
  externalId: string;
  state: EfacturaState;
  /// Present when the buyer rejected, in their own words.
  reason?: string;
  changedAt: string;
}

export interface IncomingDocument {
  externalId: string;
  supplier: EfacturaParty;
  series: string;
  number: string;
  issueDate: string;
  total: string;
  currency: string;
  rawXml: string;
}

export interface EfacturaProvider {
  submit(document: EfacturaDocument): Promise<SubmissionResult>;
  getStatus(externalId: string): Promise<DocumentStatus>;
  listIncoming(since: Date): Promise<IncomingDocument[]>;
  respond(externalId: string, action: 'ACCEPT' | 'REJECT', reason?: string): Promise<void>;
}

/// Injection token. Which implementation is bound is decided by
/// EFACTURA_PROVIDER, in efactura.module.ts, and nowhere else.
export const EFACTURA_PROVIDER = Symbol('EFACTURA_PROVIDER');
