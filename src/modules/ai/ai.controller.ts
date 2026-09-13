import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';

import { AiService } from './ai.service';
import { AiSettingsDto, AiStatusResponse, InvoiceDraftDto, InvoiceDraftResponse } from './dto/ai.dto';

@ApiTags('ai')
@ApiCookieAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('status')
  @ApiOkResponse({ type: AiStatusResponse })
  status(@CurrentUser() user: AuthenticatedUser): Promise<AiStatusResponse> {
    return this.ai.status(user.companyId);
  }

  /// Only the owner decides whether the company's text leaves for a provider.
  @Put('settings')
  @Roles('OWNER')
  @ApiOkResponse({ type: AiStatusResponse })
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AiSettingsDto,
  ): Promise<AiStatusResponse> {
    return this.ai.setEnabled(user, dto.enabled);
  }

  @Post('invoice-draft')
  @Roles('OWNER', 'ACCOUNTANT')
  @HttpCode(200)
  @ApiOkResponse({ type: InvoiceDraftResponse })
  @ApiForbiddenResponse({ description: 'ai_disabled' })
  @ApiTooManyRequestsResponse({ description: 'ai_quota_exceeded' })
  @ApiUnprocessableEntityResponse({ description: 'ai_nothing_found | ai_refused' })
  @ApiServiceUnavailableResponse({ description: 'ai_unavailable | ai_busy' })
  @ApiBadGatewayResponse({ description: 'ai_failed' })
  draftInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InvoiceDraftDto,
  ): Promise<InvoiceDraftResponse> {
    return this.ai.draftInvoice(user, dto);
  }
}
