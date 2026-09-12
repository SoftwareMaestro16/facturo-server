import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

/// Secrets are passed per call rather than registered here, because access and
/// refresh tokens are signed with different keys.
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, GoogleController],
  providers: [AuthService, SessionService, TokenService, GoogleService],
  exports: [JwtModule, TokenService, SessionService, AuthService],
})
export class AuthModule {}
