import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/// Google reports whether the email is new to us, so there is nothing left
/// for the caller to choose between logging in and registering: one DTO,
/// one endpoint.
export class GoogleAuthDto {
  @ApiProperty()
  @IsString()
  @Length(1, 8192)
  credential!: string;
}

export class GoogleChallengeResponse {
  @ApiProperty()
  nonce!: string;
}
