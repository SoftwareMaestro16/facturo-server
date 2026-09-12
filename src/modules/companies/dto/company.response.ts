import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompanyResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ description: 'IDNO, 13 digits' }) idno!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() vatCode!: string | null;
  @ApiProperty() isVatPayer!: boolean;
  @ApiPropertyOptional() address!: string | null;
  @ApiPropertyOptional() city!: string | null;
  @ApiProperty() country!: string;
  @ApiPropertyOptional() email!: string | null;
  @ApiPropertyOptional() phone!: string | null;
  @ApiPropertyOptional({ description: 'Bank account the customer is asked to pay into' })
  iban!: string | null;
  @ApiPropertyOptional() bankName!: string | null;
  @ApiPropertyOptional() bankBic!: string | null;
  @ApiProperty({ enum: ['ro', 'ru'] }) locale!: string;
}
