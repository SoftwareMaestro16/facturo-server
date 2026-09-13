import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RejectIncomingDto {
  @ApiProperty({ description: 'Why the company does not recognise or agree with this document' })
  @IsString()
  @Length(1, 500)
  reason!: string;
}
