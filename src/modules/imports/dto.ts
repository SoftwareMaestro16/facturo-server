import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class ImportUploadDto {
  @ApiProperty({ enum: ['COUNTERPARTIES', 'PRODUCTS'] })
  @IsIn(['COUNTERPARTIES', 'PRODUCTS'])
  kind!: 'COUNTERPARTIES' | 'PRODUCTS';

  @ApiProperty({ type: 'string', format: 'binary' })
  @IsOptional()
  file?: string;
}

export class ImportRowError {
  @ApiProperty() row!: number;
  @ApiProperty() field!: string;
  @ApiProperty() code!: string;
}

export class ImportResponse {
  @ApiProperty() totalRows!: number;
  @ApiProperty() okRows!: number;
  @ApiProperty({ type: [ImportRowError] }) errors!: ImportRowError[];
}
