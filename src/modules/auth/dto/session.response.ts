import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UserRole } from '@prisma/client';

/// What the client gets after logging in. Deliberately free of tokens: those
/// travel as httpOnly cookies, where JavaScript cannot reach them.
export class SessionResponse {
  @ApiProperty() userId!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null until the person creates or joins a company',
  })
  companyId!: string | null;
  @ApiProperty() email!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ enum: ['OWNER', 'ACCOUNTANT', 'VIEWER'] }) role!: UserRole;
  @ApiProperty({ type: String, nullable: true }) companyName!: string | null;
  @ApiProperty({ type: String, nullable: true, enum: ['ro', 'ru'] }) locale!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) vatCode?: string | null;
}
