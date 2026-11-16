import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RateLimitGuard } from '../common/rate-limit.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { PasswordReset } from './password-reset.entity.js';
import { EmailVerification } from './email-verification.entity.js';
import { Session } from './session.entity.js';
import { User } from './user.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Session, PasswordReset, EmailVerification])],
  providers: [
    AuthService,
    // ordem importa: primeiro autentica, depois o rate limit já sabe quem é o utilizador
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  controllers: [AuthController],
})
export class AuthModule {}
