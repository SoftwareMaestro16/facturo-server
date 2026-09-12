import type { UserRole } from '@prisma/client';

/// What the access token carries and what every service scopes its queries by.
///
/// `companyId` is guaranteed present here. A freshly authenticated Google
/// identity with no company yet gets a token whose companyId is null instead
/// — see `AccessTokenPayload` below — and `JwtAuthGuard` refuses to let a
/// token like that reach any handler that expects this type, unless that
/// handler is explicitly marked `@AllowNoCompany()`. That guarantee is what
/// lets every existing controller keep reading `user.companyId` as a plain
/// string, with nothing to change when a person can belong to more than one
/// company.
export interface AuthenticatedUser {
  userId: string;
  companyId: string;
  role: UserRole;
  email: string;
}

/// The raw shape signed into the JWT and read back out of it — the only
/// version of this type where companyId is allowed to be absent. Used by the
/// token service, the guard, and the handful of onboarding endpoints that run
/// before a company exists (list my companies, create one, switch to one).
export interface AccessTokenPayload {
  userId: string;
  companyId: string | null;
  role: UserRole;
  email: string;
}
