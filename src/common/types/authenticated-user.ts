import type { UserRole } from '@prisma/client';

/// What the access token carries and what every service scopes its queries by.
export interface AuthenticatedUser {
  userId: string;
  companyId: string;
  role: UserRole;
  email: string;
}
