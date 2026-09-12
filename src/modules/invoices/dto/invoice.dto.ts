import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PageMeta } from '@/common/dto';

const MONEY_PATTERN = /^\d{1,10}(?:\.\d{1,2})?$/;
const QUANTITY_PATTERN = /^\d{1,9}(?:\.\d{1,3})?$/;
const RATE_PATTERN = /^\d{1,3}(?:\.\d{1,2})?$/;

export class InvoiceLineDto {
  @ApiProperty({ example: 'Consultanță IT' })
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiPropertyOptional({ example: 'H87' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  unit?: string;

  @ApiProperty({ example: '2.500', description: 'Up to three decimals' })
  @Matches(QUANTITY_PATTERN, { message: 'quantity must have at most 3 decimals' })
  quantity!: string;

  @ApiProperty({ example: '1250.00', description: 'Net unit price, VAT excluded' })
  @Matches(MONEY_PATTERN, { message: 'priceNet must have at most 2 decimals' })
  priceNet!: string;

  @ApiProperty({ example: '20', description: 'One of the platform rates' })
  @Matches(RATE_PATTERN, { message: 'vatRate must be a numeric percentage' })
  @IsIn(['20', '8', '0'])
  vatRate!: string;

  @ApiPropertyOptional({ description: 'Reference to a product in the catalogue' })
  @IsOptional()
  @IsString()
  productId?: string;
}

export class CreateInvoiceDto {
  @ApiPropertyOptional({ enum: ['SHORT', 'LONG'], default: 'LONG' })
  @IsOptional()
  @IsIn(['SHORT', 'LONG'])
  cycle?: 'SHORT' | 'LONG';

  @ApiPropertyOptional({ description: 'Draft series; defaults to the company default' })
  @IsOptional()
  @IsString()
  @Length(1, 10)
  series?: string;

  @ApiProperty({ description: 'YYYY-MM-DD; today or up to 10 days ahead' })
  @IsDateString()
  issueDate!: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ description: 'Existing counterparty id' })
  @IsString()
  @Length(1, 32)
  counterpartyId!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) loadingPoint?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) unloadingPoint?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) transporterName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{13}$/, { message: 'transporterIdno must be exactly 13 digits' })
  transporterIdno?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) vehicleNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) driverName?: string;

  @ApiProperty({ type: [InvoiceLineDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];
}

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {}

export class InvoiceLineResponse {
  @ApiProperty() id!: string;
  @ApiProperty() position!: number;
  @ApiProperty() name!: string;
  @ApiProperty() unit!: string;
  @ApiProperty() quantity!: string;
  @ApiProperty() priceNet!: string;
  @ApiProperty() vatRate!: string;
  @ApiProperty() amountNet!: string;
  @ApiProperty() vatAmount!: string;
  @ApiProperty() amountGross!: string;
}

export class InvoiceResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['OUTGOING', 'INCOMING'] }) direction!: string;
  @ApiProperty({
    enum: ['DRAFT', 'SIGNED', 'SENT', 'RECEIVED', 'FINISHED', 'CANCELLATION_REQUESTED', 'CANCELLED', 'ERROR'],
  })
  status!: string;
  @ApiProperty({ enum: ['SHORT', 'LONG'] }) cycle!: string;
  @ApiPropertyOptional() statusReason!: string | null;
  @ApiProperty() series!: string;
  @ApiProperty() number!: number;
  @ApiProperty() issueDate!: string;
  @ApiPropertyOptional() deliveryDate!: string | null;
  @ApiPropertyOptional() dueDate!: string | null;
  @ApiPropertyOptional() counterpartyId!: string | null;
  @ApiProperty() counterpartyName!: string;
  @ApiProperty() counterpartyIdno!: string;
  @ApiPropertyOptional() counterpartyVatCode!: string | null;
  @ApiPropertyOptional() counterpartyAddress!: string | null;
  @ApiProperty() currency!: string;
  @ApiProperty() subtotal!: string;
  @ApiProperty() vatTotal!: string;
  @ApiProperty() total!: string;
  @ApiPropertyOptional() notes!: string | null;
  @ApiPropertyOptional() loadingPoint!: string | null;
  @ApiPropertyOptional() unloadingPoint!: string | null;
  @ApiProperty({ type: [InvoiceLineResponse] }) lines!: InvoiceLineResponse[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class InvoiceListItemResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['OUTGOING', 'INCOMING'] }) direction!: string;
  @ApiProperty() status!: string;
  @ApiProperty() cycle!: string;
  @ApiProperty() series!: string;
  @ApiProperty() number!: number;
  @ApiProperty() issueDate!: string;
  @ApiProperty() counterpartyName!: string;
  @ApiProperty() total!: string;
  @ApiProperty() currency!: string;
}

export class InvoicePage {
  @ApiProperty({ type: [InvoiceListItemResponse] }) items!: InvoiceListItemResponse[];
  @ApiProperty({ type: PageMeta }) meta!: PageMeta;
}

export class InvoiceQuery {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) search?: string;

  @ApiPropertyOptional({ enum: ['OUTGOING', 'INCOMING'] })
  @IsOptional()
  @IsIn(['OUTGOING', 'INCOMING'])
  direction?: 'OUTGOING' | 'INCOMING';

  @ApiPropertyOptional({
    enum: ['DRAFT', 'SIGNED', 'SENT', 'RECEIVED', 'FINISHED', 'CANCELLATION_REQUESTED', 'CANCELLED', 'ERROR'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }
}
