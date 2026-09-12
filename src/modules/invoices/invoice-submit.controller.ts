import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { EfacturaService } from '@/modules/efactura/efactura.service';

/// Deliberately a separate controller from InvoicesController.
///
/// Send is the boundary between our world and the tax platform: it needs its
/// own visibility on failures, its own audit trail, and (later) its own retry
/// hooks. Mixing it in with plain CRUD blurs where those live.
@ApiTags('invoices')
@ApiCookieAuth()
@Controller('invoices/:id')
export class InvoiceSubmitController {
  constructor(private readonly efactura: EfacturaService) {}

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
}
