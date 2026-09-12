import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/// Authentication is on by default. This marks the handful of endpoints that
/// are deliberately open: login, register, health, the maib callback.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
