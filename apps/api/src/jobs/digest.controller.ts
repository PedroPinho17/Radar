import { BadRequestException, Controller, Post } from '@nestjs/common';
import { CurrentUser, type UserDto } from '../auth/auth.decorators.js';
import { MINUTE, RateLimit } from '../common/rate-limit.js';
import { DigestService } from './digest.service.js';

@Controller('digest')
export class DigestController {
  constructor(private readonly digest: DigestService) {}

  /** Envia já um email de teste com as ofertas das últimas 24h (não mexe no agendamento). */
  @Post('send-now')
  @RateLimit({ limit: 3, windowMs: 15 * MINUTE, by: 'user' })
  sendNow(@CurrentUser() user: UserDto) {
    if (!user.emailVerified) throw new BadRequestException('Confirma primeiro o teu email (vê a tua caixa de correio).');
    return this.digest.sendFor(user, { manual: true });
  }
}
