import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';

import {
  CreateInvoiceDto,
  InvoiceLineDto,
  InvoicePage,
  InvoiceQuery,
  InvoiceResponse,
  UpdateInvoiceDto,
} from './dto';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@ApiCookieAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @ApiOkResponse({ type: InvoicePage })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: InvoiceQuery): Promise<InvoicePage> {
    return this.invoices.list(user.companyId, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: InvoiceResponse })
  @ApiNotFoundResponse({ description: 'invoice_not_found' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<InvoiceResponse> {
    return this.invoices.findOne(user.companyId, id);
  }

  @Post()
  @Roles('OWNER', 'ACCOUNTANT')
  @ApiCreatedResponse({ type: InvoiceResponse })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto): Promise<InvoiceResponse> {
    return this.invoices.create(user.companyId, dto);
  }

  /// Recomputes totals without saving. The form uses this so it can show a live
  /// total as the customer types, without the client repeating the arithmetic
  /// and drifting from what the server would compute.
  @Post('preview')
  @Roles('OWNER', 'ACCOUNTANT')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Subtotal, VAT and total for the given lines' })
  preview(@Body() dto: { lines: InvoiceLineDto[] }) {
    return this.invoices.preview(dto.lines);
  }

  @Patch(':id')
  @Roles('OWNER', 'ACCOUNTANT')
  @ApiOkResponse({ type: InvoiceResponse })
  @ApiNotFoundResponse({ description: 'invoice_not_found' })
  @ApiConflictResponse({ description: 'invoice_not_editable' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ): Promise<InvoiceResponse> {
    return this.invoices.update(user.companyId, id, dto);
  }

  /// Deletes a draft only. A document past DRAFT is a fiscal record and must
  /// be cancelled, not deleted.
  @Delete(':id')
  @Roles('OWNER', 'ACCOUNTANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'invoice_not_found' })
  @ApiConflictResponse({ description: 'invoice_not_draft' })
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.invoices.remove(user.companyId, id);
  }
}
