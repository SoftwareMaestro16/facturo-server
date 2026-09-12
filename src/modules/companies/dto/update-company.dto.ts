import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

/// The IDNO is deliberately absent. It identifies the company to the tax
/// service and appears on documents already sent; changing it would silently
/// re-point a history of fiscal records at a different entity.
export class UpdateCompanyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;

  @ApiPropertyOptional({ description: '6 digits, or null when the company stops being a VAT payer' })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'vatCode must be exactly 6 digits' })
  vatCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) phone?: string;

  @ApiPropertyOptional({ example: 'MD24AG000225100013104168' })
  @IsOptional()
  @Matches(/^MD\d{2}[A-Z0-9]{20}$/, { message: 'iban must be a Moldovan IBAN' })
  iban?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) bankName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(11) bankBic?: string;

  @ApiPropertyOptional({ enum: ['ro', 'ru'] })
  @IsOptional()
  @IsIn(['ro', 'ru'])
  locale?: 'ro' | 'ru';
}
