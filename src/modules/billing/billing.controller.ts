import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';

import { BillingService } from './billing.service';
import { CheckoutDto, CheckoutResponse, SubscriptionResponse } from './dto';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @ApiCookieAuth()
  @Get('subscription')
  @ApiOkResponse({ type: SubscriptionResponse })
  getSubscription(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionResponse> {
    return this.billing.getSubscription(user.companyId);
  }

  @ApiCookieAuth()
  @Post('checkout')
  @Roles('OWNER', 'ACCOUNTANT')
  @ApiCreatedResponse({ type: CheckoutResponse })
  checkout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckoutDto): Promise<CheckoutResponse> {
    return this.billing.checkout(user.companyId, user, dto);
  }

  /// Public by necessity: this is maib's own server calling us, not a signed-in
  /// person. The signature check inside billing.service.ts is what stands in
  /// for authentication here — see .claude/skills/payments-maib/SKILL.md.
  @Public()
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Acknowledged. Never answer with an error for a merely unrecognised payment.',
  })
  async callback(@Req() request: RawBodyRequest<Request>): Promise<void> {
    if (!request.rawBody) {
      throw new BadRequestException({ code: 'payment_invalid_body', message: 'Missing request body' });
    }

    await this.billing.handleCallback(request.rawBody.toString('utf8'));
  }
}
