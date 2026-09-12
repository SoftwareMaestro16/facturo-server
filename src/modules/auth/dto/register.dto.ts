import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'SRL Exemplu' })
  @IsString()
  @Length(2, 200)
  companyName!: string;

  @ApiProperty({ description: 'IDNO, 13 digits', example: '1003600012345' })
  @Matches(/^\d{13}$/, { message: 'idno must be exactly 13 digits' })
  idno!: string;

  @ApiPropertyOptional({ description: 'VAT registration code, 6 digits', example: '0123456' })
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'vatCode must be exactly 6 digits' })
  vatCode?: string;

  @ApiProperty({ example: 'director@exemplu.md' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({ example: '+373 69 123 456' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiProperty({ example: 'Ion Popescu' })
  @IsString()
  @Length(2, 120)
  fullName!: string;

  @ApiProperty({ minLength: 8, description: 'Checked against the password policy' })
  @IsString()
  @Length(8, 128)
  password!: string;

  @ApiPropertyOptional({ enum: ['ro', 'ru'], default: 'ro' })
  @IsOptional()
  @IsIn(['ro', 'ru'])
  locale?: 'ro' | 'ru';
}
