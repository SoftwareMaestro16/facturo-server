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
import type { AuthenticatedUser } from '@/common/types/authenticated-user';

import { CreateProductDto, ProductPage, ProductQuery, ProductResponse, UpdateProductDto } from './dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiCookieAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOkResponse({ type: ProductPage })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ProductQuery): Promise<ProductPage> {
    return this.products.list(user.companyId, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: ProductResponse })
  @ApiNotFoundResponse({ description: 'product_not_found' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ProductResponse> {
    return this.products.findOne(user.companyId, id);
  }

  @Post()
  @Roles('OWNER', 'ACCOUNTANT')
  @ApiCreatedResponse({ type: ProductResponse })
  @ApiConflictResponse({ description: 'product_code_exists' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProductDto): Promise<ProductResponse> {
    return this.products.create(user.companyId, dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'ACCOUNTANT')
  @ApiOkResponse({ type: ProductResponse })
  @ApiNotFoundResponse({ description: 'product_not_found' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponse> {
    return this.products.update(user.companyId, id, dto);
  }

  /// Archives rather than deletes. See ProductsService.archive.
  @Delete(':id')
  @Roles('OWNER', 'ACCOUNTANT')
  @ApiOkResponse({ type: ProductResponse })
  @ApiNotFoundResponse({ description: 'product_not_found' })
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<ProductResponse> {
    return this.products.archive(user.companyId, id);
  }
}
