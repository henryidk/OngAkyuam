import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuditService } from './services/audit.service';
import { AuthenticatedUserResolver } from './services/authenticated-user.resolver';
import { CookieService } from './services/cookie.service';
import { LockoutService } from './services/lockout.service';
import { SocketAuthService } from './services/socket-auth.service';
import { TokenService } from './services/token.service';
import { UserCacheService } from './services/user-cache.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  // JwtModule se registra sin secret/expiresIn globales: access y refresh usan
  // secrets distintos, TokenService los pasa explícitamente en cada sign/verify.
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    TokenService,
    LockoutService,
    AuditService,
    CookieService,
    UserCacheService,
    AuthenticatedUserResolver,
    SocketAuthService,
  ],
  exports: [AuthService, AuditService, SocketAuthService, UserCacheService],
})
export class AuthModule {}
