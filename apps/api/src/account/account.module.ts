import { Controller, Get, Header, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrentUser, type UserDto } from '../auth/auth.decorators.js';
import { EmailVerification } from '../auth/email-verification.entity.js';
import { PasswordReset } from '../auth/password-reset.entity.js';
import { Session } from '../auth/session.entity.js';
import { User } from '../auth/user.entity.js';
import { MINUTE, RateLimit } from '../common/rate-limit.js';
import { Application } from '../jobs/application.entity.js';
import { Match } from '../jobs/match.entity.js';
import { Preferences } from '../profile/preferences.entity.js';
import { Profile } from '../profile/profile.entity.js';
import { AccountService } from './account.service.js';
import { HealthController } from './health.controller.js';
import { Feedback } from './feedback.entity.js';
import { FeedbackService } from './feedback.service.js';
import { FeedbackController } from './feedback.controller.js';

@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  /** RGPD: descarrega todos os teus dados em JSON. */
  @Get('export')
  @RateLimit({ limit: 5, windowMs: 10 * MINUTE, by: 'user' })
  @Header('Content-Disposition', 'attachment; filename="radar-os-meus-dados.json"')
  export(@CurrentUser() user: UserDto) {
    return this.account.export(user.id);
  }

  /** Em que passo dos "primeiros passos" está a pessoa. */
  @Get('onboarding')
  onboarding(@CurrentUser() user: UserDto) {
    return this.account.onboarding(user);
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Profile, Preferences, Match, Application, Session, PasswordReset, EmailVerification, Feedback]),
  ],
  providers: [AccountService, FeedbackService],
  controllers: [AccountController, HealthController, FeedbackController],
})
export class AccountModule {}
