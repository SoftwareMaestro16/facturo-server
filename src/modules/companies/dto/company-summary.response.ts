import { ApiProperty } from '@nestjs/swagger';
import type { UserRole } from '@prisma/client';

/// One row per company a person belongs to. `isCurrent` marks which one their
/// token is currently scoped to — switching changes that, not this list.
export class CompanySummary {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ description: 'IDNO, 13 digits' }) idno!: string;
  @ApiProperty({ enum: ['OWNER', 'ACCOUNTANT', 'VIEWER'] }) role!: UserRole;
  @ApiProperty() isCurrent!: boolean;
}
