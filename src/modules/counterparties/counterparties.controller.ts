import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { PaginationQuery } from '@/common/dto';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';

import { CounterpartiesService } from './counterparties.service';
import { CounterpartyPage, CounterpartyResponse, CreateCounterpartyDto, UpdateCounterpartyDto } from './dto';

@ApiTags('counterparties')
@ApiCookieAuth()
@Controller('counterparties')
export class CounterpartiesController {
  constructor(private readonly counterparties: CounterpartiesService) {}

  @Get()
  @ApiOkResponse({ type: CounterpartyPage })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQuery): Promise<CounterpartyPage> {
    return this.counterparties.list(user.companyId, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: CounterpartyResponse })
  @ApiNotFoundResponse({ description: 'counterparty_not_found' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<CounterpartyResponse> {
    return this.counterparties.findOne(user.companyId, id);
  }

  @Post()
  @Roles('OWNER', 'ACCOUNTANT')
  @ApiCreatedResponse({ type: CounterpartyResponse })
  @ApiConflictResponse({ description: 'counterparty_exists' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCounterpartyDto,
  ): Promise<CounterpartyResponse> {
    return this.counterparties.create(user.companyId, dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'ACCOUNTANT')
  @ApiOkResponse({ type: CounterpartyResponse })
  @ApiNotFoundResponse({ description: 'counterparty_not_found' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCounterpartyDto,
  ): Promise<CounterpartyResponse> {
    return this.counterparties.update(user.companyId, id, dto);
  }

  /// Archives rather than deletes. The row is named on documents that have to
  /// survive six years.
  @Delete(':id')
  @Roles('OWNER', 'ACCOUNTANT')
  @ApiOkResponse({ type: CounterpartyResponse })
  @ApiNotFoundResponse({ description: 'counterparty_not_found' })
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<CounterpartyResponse> {
    return this.counterparties.archive(user.companyId, id);
  }
}
