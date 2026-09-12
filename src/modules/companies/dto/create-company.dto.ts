import { OmitType } from '@nestjs/swagger';

import { RegisterDto } from '@/modules/auth/dto';

/// Same company fields as registration, minus the person fields the token
/// already carries — the owner is whoever is signed in, not whoever is named.
export class CreateCompanyDto extends OmitType(RegisterDto, [
  'email',
  'phone',
  'fullName',
  'password',
] as const) {}
