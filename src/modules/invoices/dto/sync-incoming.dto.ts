import { ApiProperty } from '@nestjs/swagger';

export class SyncIncomingResponse {
  @ApiProperty({ description: 'New incoming documents found since the last check' })
  created!: number;
}
