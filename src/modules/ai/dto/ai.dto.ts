import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsString, Length } from 'class-validator';

export class AiStatusResponse {
  @ApiProperty({ description: 'The company owner turned the assistant on' }) enabled!: boolean;
  @ApiProperty({ type: String, nullable: true }) enabledAt!: string | null;
  @ApiProperty({ description: 'A provider is connected on this server' }) available!: boolean;
  @ApiProperty() usedToday!: number;
  @ApiProperty() dailyLimit!: number;
}

export class AiSettingsDto {
  @ApiProperty() @IsBoolean() enabled!: boolean;
}

export class InvoiceDraftDto {
  @ApiProperty({ example: '2 часа консультации по 500 лей для Atelier Nord' })
  @IsString()
  @Length(3, 1000)
  text!: string;

  @ApiProperty({ enum: ['ru', 'ro'] })
  @IsIn(['ru', 'ro'])
  locale!: 'ru' | 'ro';
}

export class InvoiceDraftLine {
  @ApiProperty() name!: string;
  @ApiProperty({ example: '2' }) quantity!: string;
  @ApiProperty({ type: String, nullable: true, example: '500.00' }) priceNet!: string | null;
  @ApiProperty({ enum: ['20', '8', '0'] }) vatRate!: '20' | '8' | '0';
  @ApiProperty({ type: String, nullable: true }) productId!: string | null;
}

/// A proposal for the invoice form. Nothing is saved: the person reviews it,
/// changes what is wrong and saves the invoice the usual way.
export class InvoiceDraftResponse {
  @ApiProperty({ type: String, nullable: true }) counterpartyId!: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Buyer as the person wrote it' })
  buyerName!: string | null;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty({ type: [InvoiceDraftLine] }) lines!: InvoiceDraftLine[];
  @ApiProperty({
    type: [String],
    description:
      'buyer_not_found | buyer_ambiguous | price_missing | vat_assumed | lines_truncated | line_dropped',
  })
  warnings!: string[];
}
