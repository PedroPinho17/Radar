import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { z } from 'zod';
import type { UserDto } from '../auth/auth.decorators.js';
import { Match } from '../jobs/match.entity.js';
import { MailService } from '../mail/mail.service.js';
import { Feedback, FEEDBACK_TYPES } from './feedback.entity.js';

const TYPE_PT: Record<string, string> = {
  bug: 'Erro no site', oferta: 'Oferta mal avaliada', sugestao: 'Sugestão', outro: 'Outro',
};

const feedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES, { error: 'Escolhe o tipo de problema.' }),
  message: z.string().trim().min(10, 'Conta-nos um pouco mais (pelo menos 10 caracteres).').max(2000, 'A mensagem é demasiado longa (máx. 2000).'),
  page: z.string().trim().max(200).regex(/^\/[\w\-/]*$/, 'Página inválida.').optional(),
  matchId: z.uuid().optional(),
});

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  private readonly notifyTo?: string;

  constructor(
    @InjectRepository(Feedback) private readonly feedback: Repository<Feedback>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.notifyTo = config.get<string>('ALERT_EMAIL') || undefined;
  }

  /** Guarda o que a pessoa reportou e avisa quem gere o Radar por email. */
  async create(user: UserDto, body: unknown) {
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Dados inválidos.');
    const { type, message, page, matchId } = parsed.data;

    // só pode referir ofertas avaliadas para si
    const match = matchId
      ? await this.matches.findOne({ where: { id: matchId, userId: user.id }, relations: { job: true } })
      : null;
    if (matchId && !match) throw new NotFoundException('Oferta não encontrada.');

    const saved = await this.feedback.save(
      this.feedback.create({ userId: user.id, type, message, page: page ?? null, matchId: match?.id ?? null }),
    );

    if (this.notifyTo) {
      const lines = [
        `De: ${user.email}`,
        `Tipo: ${TYPE_PT[type]}`,
        ...(page ? [`Página: ${page}`] : []),
        ...(match ? [`Oferta: ${match.job.title} @ ${match.job.company} (nota ${match.score})`, `Razões da IA: ${match.reasons.join(' | ')}`] : []),
        '',
        message,
      ];
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${lines
        .map((l) => (l ? `<p style="margin:0 0 6px">${esc(l)}</p>` : '<hr>'))
        .join('')}</div>`;
      // em segundo plano: a pessoa não espera pelo SMTP
      void this.mail
        .send(this.notifyTo, `[Radar] ${TYPE_PT[type]}: ${message.slice(0, 60)}`, html, {
          text: lines.join('\n'),
          headers: { 'Reply-To': user.email },
        })
        .catch((err: Error) => this.logger.warn(`Aviso de feedback não enviado: ${err.message}`));
    }
    return { id: saved.id, ok: true };
  }

  /** Para a página de estado (admins): os mais recentes primeiro, por resolver primeiro. */
  async list() {
    const rows = await this.feedback.find({ relations: { user: true }, order: { createdAt: 'DESC' }, take: 100 });
    return rows
      .map((f) => ({
        id: f.id, type: f.type, message: f.message, page: f.page, matchId: f.matchId,
        email: f.user?.email ?? null, createdAt: f.createdAt, resolvedAt: f.resolvedAt,
      }))
      .sort((a, b) => Number(!!a.resolvedAt) - Number(!!b.resolvedAt));
  }

  async resolve(id: string) {
    const { affected } = await this.feedback.update({ id }, { resolvedAt: new Date() });
    if (!affected) throw new NotFoundException();
    return { ok: true };
  }
}
