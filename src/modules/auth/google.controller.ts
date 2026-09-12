import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { Public } from '@/common/decorators/public.decorator';
import { readRequestContext } from '@/common/utils/request-context';
import { TypedConfigService } from '@/config/typed-config.service';

import { AuthService } from './auth.service';
import { setAuthCookies } from './cookies';
import { SessionResponse } from './dto';
import { GoogleAuthDto, GoogleChallengeResponse } from './dto/google.dto';
import { GoogleService } from './google.service';
import { TokenService } from './token.service';

const NONCE_COOKIE = 'google_nonce';

/// One endpoint for both: Google already tells us whether the email is new,
/// so there is nothing left for the caller to choose between logging in and
/// registering.
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

  @Get('challenge')
  @ApiOkResponse({ type: GoogleChallengeResponse })
  challenge(@Res({ passthrough: true }) response: Response): GoogleChallengeResponse {
    const nonce = this.google.challenge();
    response.setHeader('Cache-Control', 'no-store');
    response.cookie(NONCE_COOKIE, nonce, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      path: '/api/auth/google',
      maxAge: 10 * 60 * 1000,
    });
    return { nonce };
  }

  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: SessionResponse })
  @ApiUnauthorizedResponse({ description: 'google_invalid' })
  async authenticate(
    @Body() dto: GoogleAuthDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const identity = await this.google.verify(dto.credential, this.readNonce(request));
    const result = await this.auth.googleAuth(identity, readRequestContext(request));
    response.clearCookie(NONCE_COOKIE, { path: '/api/auth/google' });
    setAuthCookies(response, result.tokens, this.config, this.tokens);
    return result.session;
  }

  private readNonce(request: Request): unknown {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    return cookies?.[NONCE_COOKIE];
  }
}
