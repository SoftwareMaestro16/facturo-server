import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AllowNoCompany } from '@/common/decorators/allow-no-company.decorator';
import { CurrentIdentity } from '@/common/decorators/current-identity.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import type { AccessTokenPayload, AuthenticatedUser } from '@/common/types/authenticated-user';
import { readRequestContext } from '@/common/utils/request-context';
import { TypedConfigService } from '@/config/typed-config.service';

import { AuthService } from './auth.service';
import { clearAuthCookies, readRefreshCookie, setAuthCookies } from './cookies';
import { ChangePasswordDto, LoginDto, RegisterDto, SessionResponse } from './dto';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

/// HTTP only: routes, status codes and cookies. Every rule lives in the service
/// or, where it is pure, in model/.
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly config: TypedConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiCreatedResponse({ type: SessionResponse })
  @ApiConflictResponse({ description: 'email_taken | company_exists' })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const result = await this.auth.register(dto, readRequestContext(request));
    setAuthCookies(response, result.tokens, this.config, this.tokens);

    return result.session;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SessionResponse })
  @ApiUnauthorizedResponse({ description: 'invalid_credentials' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const result = await this.auth.login(dto, readRequestContext(request));
    setAuthCookies(response, result.tokens, this.config, this.tokens);

    return result.session;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'New cookies are set' })
  @ApiUnauthorizedResponse({ description: 'invalid_refresh_token' })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    const presented = readRefreshCookie(request);
    const rotated = presented
      ? await this.sessions.rotate(presented, readRequestContext(request))
      : undefined;

    if (!rotated) {
      // Clear the cookies too: leaving a dead token in the browser makes the
      // client retry forever instead of showing the sign-in screen.
      clearAuthCookies(response, this.config);
      throw new UnauthorizedException({
        code: 'invalid_refresh_token',
        message: 'Session is no longer valid',
      });
    }

    setAuthCookies(response, rotated, this.config, this.tokens);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Cookies cleared whether or not a session was live' })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    const presented = readRefreshCookie(request);

    if (presented) {
      await this.sessions.revokeByToken(presented);
    }

    clearAuthCookies(response, this.config);
  }

  @ApiCookieAuth()
  @AllowNoCompany()
  @Get('me')
  @ApiOkResponse({ type: SessionResponse })
  describe(@CurrentIdentity() identity: AccessTokenPayload): Promise<SessionResponse> {
    return this.auth.describe(identity);
  }

  @ApiCookieAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Every session is revoked; the caller signs in again' })
  @ApiUnauthorizedResponse({ description: 'invalid_credentials | no_password_set' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.changePassword(user, dto, readRequestContext(request));
    clearAuthCookies(response, this.config);
  }
}
