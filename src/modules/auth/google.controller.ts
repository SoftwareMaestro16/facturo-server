import { Body, Controller, ForbiddenException, Headers, HttpCode, Post, Req, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { Public } from '@/common/decorators/public.decorator';
import { readRequestContext } from '@/common/utils/request-context';
import { TypedConfigService } from '@/config/typed-config.service';

import { AuthService } from './auth.service';
import { setAuthCookies } from './cookies';
import { SessionResponse } from './dto';
import { GoogleAuthDto } from './dto/google.dto';
import { GoogleService } from './google.service';
import { TokenService } from './token.service';

/// One endpoint for both: Google already tells us whether the email is new,
/// so there is nothing left for the caller to choose between logging in and
/// registering.
///
/// Public by necessity — this is how a session begins.
@Public()
@ApiTags('auth')
@Controller('auth/google')
export class GoogleController {
  constructor(
    private readonly google: GoogleService,
    private readonly auth: AuthService,
    private readonly config: TypedConfigService,
    private readonly tokens: TokenService,
  ) {}

  /// The sign-in popup hands the browser a one-time code; only this server,
  /// holding the client secret, can turn it into a verified identity. The
  /// custom header cannot be set by a form on another site, and a cross-site
  /// script setting it is stopped by CORS preflight — together that closes
  /// login CSRF, where a page elsewhere signs a visitor into someone else's
  /// account.
  @Post()
  @HttpCode(200)
  @ApiHeader({ name: 'X-Requested-With', required: true, description: 'Must be XMLHttpRequest' })
  @ApiOkResponse({ type: SessionResponse })
  @ApiUnauthorizedResponse({ description: 'google_invalid' })
  @ApiBadRequestResponse({ description: 'terms_outdated' })
  @ApiForbiddenResponse({ description: 'google_invalid — the request did not come from our page' })
  async authenticate(
    @Body() dto: GoogleAuthDto,
    @Headers('x-requested-with') requestedWith: string | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    if (requestedWith !== 'XMLHttpRequest') {
      throw new ForbiddenException({ code: 'google_invalid', message: 'Missing X-Requested-With header' });
    }

    const identity = await this.google.exchangeCode(dto.code);
    const result = await this.auth.googleAuth(identity, readRequestContext(request), dto.termsVersion);
    setAuthCookies(response, result.tokens, this.config, this.tokens);
    return result.session;
  }
}
