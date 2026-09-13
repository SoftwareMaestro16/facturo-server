import { ApiProperty } from '@nestjs/swagger';

export class PersonalDataMembership {
  @ApiProperty() companyName!: string;
  @ApiProperty() companyIdno!: string;
  @ApiProperty({ enum: ['OWNER', 'ACCOUNTANT', 'VIEWER'] }) role!: string;
  @ApiProperty() since!: string;
}

export class PersonalDataSession {
  @ApiProperty() createdAt!: string;
  @ApiProperty() expiresAt!: string;
  @ApiProperty({ type: String, nullable: true }) revokedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) ip!: string | null;
  @ApiProperty({ type: String, nullable: true }) userAgent!: string | null;
}

export class PersonalDataEvent {
  @ApiProperty() type!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: String, nullable: true }) ip!: string | null;
  @ApiProperty({ type: String, nullable: true }) userAgent!: string | null;
}

/// A copy of the data kept about the signed-in person. Company documents are
/// the company's own records and are deliberately not part of it.
export class PersonalDataExport {
  @ApiProperty() exportedAt!: string;
  @ApiProperty() email!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty() signsInWithGoogle!: boolean;
  @ApiProperty() accountCreatedAt!: string;
  @ApiProperty({ type: String, nullable: true }) lastLoginAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) termsVersion!: string | null;
  @ApiProperty({ type: String, nullable: true }) termsAcceptedAt!: string | null;
  @ApiProperty({ type: [PersonalDataMembership] }) memberships!: PersonalDataMembership[];
  @ApiProperty({ type: [PersonalDataSession] }) sessions!: PersonalDataSession[];
  @ApiProperty({ type: [PersonalDataEvent] }) securityEvents!: PersonalDataEvent[];
}
