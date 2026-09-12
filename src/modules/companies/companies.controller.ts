import { Body, Controller, Get, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AllowNoCompany } from '@/common/decorators/allow-no-company.decorator';
import { CurrentIdentity } from '@/common/decorators/current-identity.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AccessTokenPayload, AuthenticatedUser } from '@/common/types/authenticated-user';
import { readRequestContext } from '@/common/utils/request-context';
import { AuthService } from '@/modules/auth/auth.service';
import { setAuthCookies } from '@/modules/auth/cookies';
import { SessionResponse } from '@/modules/auth/dto';
import { SessionService } from '@/modules/auth/session.service';
import { TokenService } from '@/modules/auth/token.service';
import { TypedConfigService } from '@/config/typed-config.service';

import { CompaniesService, type SwitchedCompany } from './companies.service';
import { CompanyResponse, CompanySummary, CreateCompanyDto, UpdateCompanyDto } from './dto';

/// Creating and switching companies reissue the auth cookies, because the
/// active company lives in the token, not in a request parameter — every
/// other endpoint here still reaches only the caller's own company.
@ApiTags('companies')
@ApiCookieAuth()
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companies: CompaniesService,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly config: TypedConfigService,
  ) {}

  @Get('me')
  @ApiOkResponse({ type: CompanyResponse })
  findOwn(@CurrentUser() user: AuthenticatedUser): Promise<CompanyResponse> {
    return this.companies.findOwn(user.companyId);
  }

  @Patch('me')
  @Roles('OWNER', 'ACCOUNTANT')
  @ApiOkResponse({ type: CompanyResponse })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateCompanyDto): Promise<CompanyResponse> {
    return this.companies.update(user.companyId, dto);
  }

  @AllowNoCompany()
  @Get()
  @ApiOkResponse({ type: [CompanySummary] })
  list(@CurrentIdentity() identity: AccessTokenPayload): Promise<CompanySummary[]> {
    return this.companies.listMine(identity.userId, identity.companyId);
  }

  @AllowNoCompany()
  @Post()
  @ApiCreatedResponse({ type: SessionResponse })
  async create(
    @CurrentIdentity() identity: AccessTokenPayload,
    @Body() dto: CreateCompanyDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const switched = await this.companies.create(identity.userId, dto);

    return this.reissue(identity, switched, request, response);
  }

  @AllowNoCompany()
  @Post(':id/switch')
  @ApiOkResponse({ type: SessionResponse })
  async switchTo(
    @CurrentIdentity() identity: AccessTokenPayload,
    @Param('id') companyId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionResponse> {
    const switched = await this.companies.switchTo(identity.userId, companyId);

    return this.reissue(identity, switched, request, response);
  }

  private async reissue(
    identity: AccessTokenPayload,
    switched: SwitchedCompany,
    request: Request,
    response: Response,
  ): Promise<SessionResponse> {
    const tokens = await this.sessions.issue(
      { id: identity.userId, companyId: switched.companyId, email: identity.email, role: switched.role },
      readRequestContext(request),
    );

    setAuthCookies(response, tokens, this.config, this.tokens);

    return this.auth.describe({ ...identity, companyId: switched.companyId, role: switched.role });
  }
}
