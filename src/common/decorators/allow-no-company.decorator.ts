import { SetMetadata } from '@nestjs/common';

export const ALLOW_NO_COMPANY_KEY = 'allowNoCompany';

/// A signed-in person with no active company is blocked from every route by
/// default — `JwtAuthGuard` throws `company_required` before the handler ever
/// runs, which is what lets the other 100-odd endpoints keep assuming
/// `@CurrentUser()` always has a companyId. This marks the small, explicit set
/// of routes that are allowed to run without one: listing a person's
/// companies, creating the first one, switching between them, and reading raw
/// identity. Use `@CurrentIdentity()`, not `@CurrentUser()`, in a handler
/// marked this way — `@CurrentUser()` still asserts a company is present.
export const AllowNoCompany = () => SetMetadata(ALLOW_NO_COMPANY_KEY, true);
