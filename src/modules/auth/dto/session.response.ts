import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UserRole } from '@prisma/client';

/// What the client gets after logging in. Deliberately free of tokens: those
/// travel as httpOnly cookies, where JavaScript cannot reach them.
export class SessionResponse {
  @ApiProperty() userId!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() email!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ enum: ['OWNER', 'ACCOUNTANT', 'VIEWER'] }) role!: UserRole;
  @ApiProperty() companyName!: string;
  @ApiProperty({ enum: ['ro', 'ru'] }) locale!: string;
  @ApiPropertyOptional() vatCode?: string | null;
}
