import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { CryptoService } from '../security/crypto.service';
import { AuthGuard } from '../security/guards/auth.guard';
import { CsrfGuard } from '../security/guards/csrf.guard';
import { RolesGuard } from '../security/guards/roles.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    SessionService,
    CryptoService,
    AuthGuard,
    CsrfGuard,
    RolesGuard,
  ],
  exports: [
    AuthService,
    OtpService,
    SessionService,
    AuthGuard,
    CsrfGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
