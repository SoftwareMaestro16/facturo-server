import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { PageMeta } from '@/common/dto';

/// Rates the platform accepts. Not an enum, because the list moves.
export const ALLOWED_VAT_RATES = ['20', '8', '0'] as const;

const MONEY_PATTERN = /^\d{1,10}(?:\.\d{1,2})?$/;

/// Decimal fields arrive as strings and stay strings until they reach Prisma.
/// A float has already lost the bani.
export class CreateProductDto {
  @ApiPropertyOptional({ example: 'SRV-001' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @ApiProperty({ example: 'Consultanță IT' })
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiPropertyOptional({ example: 'H87', description: 'Unit code from the national classifier' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  unit?: string;

  @ApiProperty({ example: '1250.00', description: 'Net unit price, VAT excluded' })
  @Matches(MONEY_PATTERN, { message: 'priceNet must have at most 2 decimals' })
  priceNet!: string;

  @ApiProperty({ enum: ALLOWED_VAT_RATES, example: '20' })
  @IsNumberString()
  @IsIn(ALLOWED_VAT_RATES)
  vatRate!: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}

export class ProductResponse {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() code!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty() unit!: string;
  @ApiProperty({ example: '1250.00' }) priceNet!: string;
  @ApiProperty({ example: '20.00' }) vatRate!: string;
  @ApiProperty() isArchived!: boolean;
}

export class ProductPage {
  @ApiProperty({ type: [ProductResponse] }) items!: ProductResponse[];
  @ApiProperty({ type: PageMeta }) meta!: PageMeta;
}

/// A query parameter arrives as a string; the pagination base already handles
/// `page` and `pageSize`. `includeArchived` needs the same conversion here.
export class ProductQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize = 25;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeArchived = false;

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }
}
