import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { Public } from '@/common/decorators/public.decorator';
import { readRequestContext } from '@/common/utils/request-context';
import { TypedConfigService } from '@/config/typed-config.service';

import { AuthService } from './auth.service';
import { setAuthCookies } from './cookies';
import { SessionResponse } from './dto';
import { GoogleChallengeResponse, GoogleLoginDto, GoogleRegisterDto } from './dto/google.dto';
import { GoogleService } from './google.service';
import { TokenService } from './token.service';

const NONCE_COOKIE = 'google_nonce';

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

  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: SessionResponse })
  @ApiUnauthorizedResponse({
    description: 'google_invalid | google_registration_required | invalid_credentials',
  })
  async login(
    @Body() dto: GoogleLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const identity = await this.google.verify(dto.credential, this.readNonce(request));
    const result = await this.auth.googleLogin(identity, readRequestContext(request));
    response.clearCookie(NONCE_COOKIE, { path: '/api/auth/google' });
    setAuthCookies(response, result.tokens, this.config, this.tokens);
    return result.session;
  }

  @Post('register')
  @ApiCreatedResponse({ type: SessionResponse })
  async register(
    @Body() dto: GoogleRegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const identity = await this.google.verify(dto.credential, this.readNonce(request));
    const result = await this.auth.googleRegister(dto, identity, readRequestContext(request));
    response.clearCookie(NONCE_COOKIE, { path: '/api/auth/google' });
    setAuthCookies(response, result.tokens, this.config, this.tokens);
    return result.session;
  }

  private readNonce(request: Request): unknown {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    return cookies?.[NONCE_COOKIE];
  }
}
