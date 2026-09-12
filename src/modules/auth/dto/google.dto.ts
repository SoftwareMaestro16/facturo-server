import { ApiProperty, OmitType } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

import { RegisterDto } from './register.dto';

export class GoogleLoginDto {
  @ApiProperty()
  @IsString()
  @Length(1, 8192)
  credential!: string;
}

export class GoogleRegisterDto extends OmitType(RegisterDto, ['email', 'fullName', 'password'] as const) {
  @ApiProperty()
  @IsString()
  @Length(1, 8192)
  credential!: string;
}

export class GoogleChallengeResponse {
  @ApiProperty()
  nonce!: string;
}
