import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

/// Phase 0 fills this in: register, login, refresh with rotation, logout,
/// change password, and the audit writes that go with each. The rules the
/// service enforces already live in model/ and are covered by unit tests.
@Module({
  imports: [JwtModule.register({})],
  exports: [JwtModule],
})
export class AuthModule {}
