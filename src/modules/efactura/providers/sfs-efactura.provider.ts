import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { TypedConfigService } from '@/config/typed-config.service';

import type {
  DocumentStatus,
  EfacturaAction,
  EfacturaDocument,
  EfacturaProvider,
  IncomingDocument,
  SubmissionResult,
} from './efactura-provider';

/// The real integration with SIA "e-Factura".
///
/// Deliberately unimplemented until two things exist that cannot be guessed
/// from outside: a signed integration agreement with SFS, and the current
/// "Ghid de integrare — API" from the Help section of the e-Factura portal.
/// Filling this in from assumptions would produce documents the validator
/// rejects, and the rejection surfaces at the customer, not here.
///
/// See PLAN.md phase 2 for the checklist, and
/// .claude/skills/efactura-standard/SKILL.md for what the platform actually
/// requires: the two lifecycles, the statuses, the issue-date rules and the
/// cancellation flow.
@Injectable()
export class SfsEfacturaProvider implements EfacturaProvider {
  constructor(private readonly config: TypedConfigService) {}

  submit(_document: EfacturaDocument): Promise<SubmissionResult> {
    return this.notReady();
  }

  getStatus(_externalId: string): Promise<DocumentStatus> {
    return this.notReady();
  }

  listIncoming(_since: Date): Promise<IncomingDocument[]> {
    return this.notReady();
  }

  act(_externalId: string, _action: EfacturaAction, _reason?: string): Promise<DocumentStatus> {
    return this.notReady();
  }

  private notReady(): Promise<never> {
    return Promise.reject(
      new ServiceUnavailableException({
        code: 'efactura_provider_not_configured',
        message: `The SFS integration is not wired up yet (base url: ${this.config.get('EFACTURA_BASE_URL') ?? 'unset'}).`,
      }),
    );
  }
}
