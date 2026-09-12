import { Injectable, NotFoundException } from '@nestjs/common';

import type {
  DocumentStatus,
  EfacturaDocument,
  EfacturaProvider,
  IncomingDocument,
  SubmissionResult,
} from './efactura-provider';

/// In-memory stand-in for the tax platform. Development and CI run against this
/// so neither needs a certificate, credentials or a working SFS endpoint.
/// It must never be bound in production — the config validator enforces that.
@Injectable()
export class SandboxEfacturaProvider implements EfacturaProvider {
  private readonly documents = new Map<string, DocumentStatus>();
  private sequence = 0;

  submit(document: EfacturaDocument): Promise<SubmissionResult> {
    this.sequence += 1;
    const externalId = `SANDBOX-${String(this.sequence).padStart(8, '0')}`;

    this.documents.set(externalId, {
      externalId,
      state: 'SENT',
      changedAt: new Date().toISOString(),
    });

    return Promise.resolve({
      externalId,
      state: 'SENT',
      requestXml: `<!-- sandbox submission for ${document.series}-${document.number} -->`,
      responseRaw: JSON.stringify({ externalId, accepted: true }),
    });
  }

  getStatus(externalId: string): Promise<DocumentStatus> {
    const status = this.documents.get(externalId);

    if (!status) {
      throw new NotFoundException({ code: 'efactura_document_not_found', message: 'Document not found' });
    }

    return Promise.resolve(status);
  }

  listIncoming(_since: Date): Promise<IncomingDocument[]> {
    return Promise.resolve([]);
  }

  respond(externalId: string, action: 'ACCEPT' | 'REJECT', reason?: string): Promise<void> {
    const status = this.documents.get(externalId);

    if (status) {
      this.documents.set(externalId, {
        ...status,
        state: action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
        reason,
        changedAt: new Date().toISOString(),
      });
    }

    return Promise.resolve();
  }
}
