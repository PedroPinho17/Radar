import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { render } from 'react-email';
import { FeedbackEmail } from '../mail/feedback-email.js';
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

/** Nomes legíveis das páginas do site, para o email não dizer só "/". */
const PAGE_PT: Record<string, string> = {
  '/': 'Ofertas', '/perfil': 'Perfil', '/candidaturas': 'Candidaturas', '/estado': 'Estado',
};

/** Só links http(s) vão para o email (o URL da oferta vem de sites externos). */
const safeHttpUrl = (u?: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  private readonly notifyTo?: string;
  private readonly webUrl: string;

  constructor(
    @InjectRepository(Feedback) private readonly feedback: Repository<Feedback>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.notifyTo = config.get<string>('ALERT_EMAIL') || undefined;
    this.webUrl = (config.get<string>('WEB_URL') ?? 'http://localhost:3000').replace(/\/+$/, '');
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
      const typeLabel = TYPE_PT[type]!;
      const email = FeedbackEmail({
        type,
        typeLabel,
        message,
        from: user.email,
        page: page ? { label: PAGE_PT[page] ?? page, url: `${this.webUrl}${page}` } : undefined,
        when: new Date().toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'long', timeStyle: 'short' }),
        statusUrl: `${this.webUrl}/estado`,
        offer: match
          ? {
              title: match.job.title, company: match.job.company, location: match.job.location, score: match.score,
              reasons: match.reasons, missing: match.missingSkills ?? [], url: safeHttpUrl(match.job.url),
            }
          : undefined,
      });
      const subject = match
        ? `[Radar] ${typeLabel} · ${match.job.title} (${match.score})`
        : `[Radar] ${typeLabel}: ${message.length > 60 ? `${message.slice(0, 60).trimEnd()}…` : message}`;
      // em segundo plano: a pessoa não espera pelo SMTP
      void Promise.all([render(email), render(email, { plainText: true })])
        .then(([html, text]) => this.mail.send(this.notifyTo!, subject, html, { text, headers: { 'Reply-To': user.email } }))
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
