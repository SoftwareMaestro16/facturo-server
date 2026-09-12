import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';

import { CompaniesService } from './companies.service';
import { CompanyResponse, UpdateCompanyDto } from './dto';

/// There is no endpoint that takes a company id. A caller only ever reaches
/// their own company, and it comes from the token.
@ApiTags('companies')
@ApiCookieAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

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
}
