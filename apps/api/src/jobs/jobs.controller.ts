import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, type UserDto } from '../auth/auth.decorators.js';
import { isAdmin } from '../common/admin.js';
import { MINUTE, RateLimit } from '../common/rate-limit.js';
import { JobsService } from './jobs.service.js';
import { MatchService } from './match.service.js';

/** Ferramentas de depuração/operação: só para ADMIN_EMAILS (os outros recebem 404). */
function adminOnly(user: UserDto) {
  if (!isAdmin(user.email)) throw new NotFoundException();
}

const letterBody = z.object({ language: z.enum(['pt', 'en']).optional() }).default({});

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly matchService: MatchService,
  ) {}

  @Get('filtered')
  filtered(@CurrentUser() user: UserDto) {
    adminOnly(user);
    return this.jobsService.filtered(user.id);
  }

  @Get('matches')
  matches(@CurrentUser() user: UserDto) {
    return this.matchService.listWithSalaries(user.id);
  }

  @Get()
  list(@CurrentUser() user: UserDto) {
    adminOnly(user);
    return this.jobsService.list();
  }

  // vai aos sites de emprego: já corre sozinho; forçar à mão só admins, e poucas vezes
  @Post('sync')
  @RateLimit({ limit: 4, windowMs: 15 * MINUTE, by: 'global' })
  sync(@CurrentUser() user: UserDto) {
    adminOnly(user);
    return this.jobsService.sync();
  }

  // cada análise chama a IA dezenas de vezes
  @Post('match')
  @RateLimit({ limit: 3, windowMs: 10 * MINUTE, by: 'user' })
  match(@CurrentUser() user: UserDto) {
    return this.matchService.matchPending(user.id);
  }

  @Post('matches/:id/decision')
  @RateLimit({ limit: 60, windowMs: MINUTE, by: 'user' })
  decide(@CurrentUser() user: UserDto, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.matchService.decide(user.id, id, body);
  }

  @Post('matches/:id/cover-letter')
  @RateLimit({ limit: 10, windowMs: 10 * MINUTE, by: 'user' })
  coverLetter(@CurrentUser() user: UserDto, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const parsed = letterBody.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException('Idioma inválido: usa "pt" ou "en".');
    return this.matchService.coverLetter(user.id, id, parsed.data.language);
  }
}
