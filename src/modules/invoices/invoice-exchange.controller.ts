import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { EfacturaService } from '@/modules/efactura/efactura.service';
import { IncomingDocumentsService } from '@/modules/efactura/incoming-documents.service';

import { RejectIncomingDto } from './dto';

/// Every action here crosses the boundary with the tax platform, or reviews a
/// document that arrived across it. Deliberately a separate controller from
/// InvoicesController's plain CRUD: this needs its own visibility on failures
/// and its own audit trail, and mixing it in blurs where those live.
@ApiTags('invoices')
@ApiCookieAuth()
@Controller('invoices/:id')
export class InvoiceExchangeController {
  constructor(
    private readonly efactura: EfacturaService,
    private readonly incoming: IncomingDocumentsService,
  ) {}

  @Post('submit')
  @Roles('OWNER', 'ACCOUNTANT')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'The document is now on the platform in state SIGNED' })
  @ApiNotFoundResponse({ description: 'invoice_not_found' })
  @ApiConflictResponse({ description: 'invoice_not_signable' })
  async submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<{ status: string }> {
    const status = await this.efactura.submit(user.companyId, id);

    return { status };
  }

  /// The buyer's own signature on an incoming document — completes the long
  /// cycle, the same as the supplier's SIGN in reverse.
  @Post('accept')
  @Roles('OWNER', 'ACCOUNTANT')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'The document is now FINISHED' })
  @ApiNotFoundResponse({ description: 'invoice_not_found' })
  @ApiConflictResponse({ description: 'invoice_not_acceptable' })
  async accept(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<{ status: string }> {
    const status = await this.incoming.acceptIncoming(user.companyId, id);

    return { status };
  }

  /// Records that the company does not recognise or agree with an incoming
  /// document. This never reaches the tax platform — see the comment on
  /// Invoice.disputedAt — so the interface must say plainly that resolving it
  /// for real means contacting the supplier.
  @Post('reject')
  @Roles('OWNER', 'ACCOUNTANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'invoice_not_found' })
  @ApiConflictResponse({ description: 'invoice_not_rejectable' })
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectIncomingDto,
  ): Promise<void> {
    await this.incoming.rejectIncoming(user.companyId, id, dto.reason);
  }
}
