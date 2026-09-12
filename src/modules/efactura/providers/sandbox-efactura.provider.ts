import { Injectable, NotFoundException } from '@nestjs/common';

import type {
  DocumentStatus,
  EfacturaAction,
  EfacturaDocument,
  EfacturaProvider,
  EfacturaState,
  IncomingDocument,
  SubmissionResult,
} from './efactura-provider';

/// In-memory stand-in for the tax platform. Development and CI run against this
/// so neither needs a certificate, credentials or a working connection to the
/// State Tax Service. It must never be bound in production — the config
/// validator enforces that.
///
/// It follows the real transition rules rather than accepting anything, so a
/// bug in our own flow shows up here instead of at the first live document.
@Injectable()
export class SandboxEfacturaProvider implements EfacturaProvider {
  private readonly documents = new Map<string, DocumentStatus>();
  private readonly cycles = new Map<string, EfacturaDocument['cycle']>();
  private sequence = 0;

  submit(document: EfacturaDocument): Promise<SubmissionResult> {
    this.sequence += 1;
    const externalId = `SANDBOX-${String(this.sequence).padStart(8, '0')}`;

    this.documents.set(externalId, {
      externalId,
      state: 'SENT',
      changedAt: new Date().toISOString(),
    });
    this.cycles.set(externalId, document.cycle);

    return Promise.resolve({
      externalId,
      state: 'SENT',
      assignedSeries: 'SBX',
      assignedNumber: String(this.sequence).padStart(8, '0'),
      requestXml: `<!-- sandbox submission for ${document.draftSeries}-${document.draftNumber} -->`,
      responseRaw: JSON.stringify({ externalId, accepted: true }),
    });
  }

  getStatus(externalId: string): Promise<DocumentStatus> {
    return Promise.resolve(this.require(externalId));
  }

  listIncoming(_since: Date): Promise<IncomingDocument[]> {
    return Promise.resolve([]);
  }

  act(externalId: string, action: EfacturaAction, reason?: string): Promise<DocumentStatus> {
    const current = this.require(externalId);
    const next: DocumentStatus = {
      ...current,
      state: this.apply(current.state, action, this.cycles.get(externalId) ?? 'LONG'),
      reason,
      changedAt: new Date().toISOString(),
    };

    this.documents.set(externalId, next);

    return Promise.resolve(next);
  }

  private apply(state: EfacturaState, action: EfacturaAction, cycle: 'SHORT' | 'LONG'): EfacturaState {
    switch (action) {
      case 'RECEIVE':
        return 'RECEIVED';
      case 'SIGN':
        return 'FINISHED';
      case 'REQUEST_CANCELLATION':
        // Only a finished long-cycle document needs the buyer's agreement.
        return cycle === 'LONG' && state === 'FINISHED' ? 'CANCELLATION_REQUESTED' : 'CANCELLED';
      case 'ACCEPT_CANCELLATION':
        return 'CANCELLED';
      case 'REJECT_CANCELLATION':
        return 'FINISHED';
    }
  }

  private require(externalId: string): DocumentStatus {
    const status = this.documents.get(externalId);

    if (!status) {
      throw new NotFoundException({ code: 'efactura_document_not_found', message: 'Document not found' });
    }

    return status;
  }
}
