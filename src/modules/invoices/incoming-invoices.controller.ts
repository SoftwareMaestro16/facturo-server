import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { IncomingDocumentsService } from '@/modules/efactura/incoming-documents.service';

import { SyncIncomingResponse } from './dto';

/// A company-level action, so it cannot live under InvoiceExchangeController's
/// `invoices/:id` — there is no single invoice id to check for new documents.
@ApiTags('invoices')
@ApiCookieAuth()
@Controller('invoices/incoming')
export class IncomingInvoicesController {
  constructor(private readonly incoming: IncomingDocumentsService) {}

  @Post('sync')
  @Roles('OWNER', 'ACCOUNTANT')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SyncIncomingResponse })
  sync(@CurrentUser() user: AuthenticatedUser): Promise<SyncIncomingResponse> {
    return this.incoming.syncIncoming(user.companyId);
  }
}
