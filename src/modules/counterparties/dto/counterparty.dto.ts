import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

import { PageMeta } from '@/common/dto';

export class CreateCounterpartyDto {
  @ApiProperty({ example: 'SRL Partener' })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiProperty({ description: 'IDNO, 13 digits', example: '1009600054321' })
  @Matches(/^\d{13}$/, { message: 'idno must be exactly 13 digits' })
  idno!: string;

  @ApiPropertyOptional({ description: 'VAT registration code, 6 digits' })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'vatCode must be exactly 6 digits' })
  vatCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) phone?: string;

  @ApiPropertyOptional({ example: 'MD24AG000225100013104168' })
  @IsOptional()
  @Matches(/^MD\d{2}[A-Z0-9]{20}$/, { message: 'iban must be a Moldovan IBAN' })
  iban?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) bankName?: string;
}

export class UpdateCounterpartyDto extends PartialType(CreateCounterpartyDto) {
  @ApiPropertyOptional({ description: 'Archived counterparties stay on old documents but leave the picker' })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}

export class CounterpartyResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() idno!: string;
  @ApiPropertyOptional() vatCode!: string | null;
  @ApiProperty() isVatPayer!: boolean;
  @ApiPropertyOptional() address!: string | null;
  @ApiPropertyOptional() email!: string | null;
  @ApiPropertyOptional() phone!: string | null;
  @ApiPropertyOptional() iban!: string | null;
  @ApiPropertyOptional() bankName!: string | null;
  @ApiProperty() isArchived!: boolean;
}

export class CounterpartyPage {
  @ApiProperty({ type: [CounterpartyResponse] }) items!: CounterpartyResponse[];
  @ApiProperty({ type: PageMeta }) meta!: PageMeta;
}
