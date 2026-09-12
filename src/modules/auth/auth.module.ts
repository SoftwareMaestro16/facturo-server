import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

/// Secrets are passed per call rather than registered here, because access and
/// refresh tokens are signed with different keys.
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, SessionService, TokenService],
  exports: [JwtModule, TokenService],
})
export class AuthModule {}
