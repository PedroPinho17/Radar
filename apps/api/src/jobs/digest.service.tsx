import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { DataSource, Repository } from 'typeorm';
import { withLock } from '../common/db-lock.js';
import { render } from 'react-email';
import { User } from '../auth/user.entity.js';
import { MailService } from '../mail/mail.service.js';
import { DigestEmail } from '../mail/digest-email.js';
import { PreferencesService } from '../profile/preferences.service.js';
import { MatchService } from './match.service.js';
import { ApplicationsService } from './applications.service.js';
import { JobsService } from './jobs.service.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { MonitorService } from '../mail/monitor.service.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const TZ = 'Europe/Lisbon';
const STATUS_PT: Record<string, string> = {
  applied: 'candidatura enviada', interview: 'entrevista', offer: 'proposta',
  accepted: 'aceite', rejected: 'rejeitada', withdrawn: 'desisti',
};
const MODEL_PT: Record<string, string> = { remote: 'Remoto', hybrid: 'Híbrido', onsite: 'Presencial' };
const eur = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 });
const salaryLabel = (min: number | null, max: number | null) =>
  min || max ? `${min ? eur.format(min) : '?'} – ${max ? eur.format(max) : '?'} €` : null;
const dateLabel = (d: Date) =>
  new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', weekday: 'long', day: 'numeric', month: 'long' }).format(d);

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Dia da semana, hora "HH:MM" (arredondada à meia hora) e data em Lisboa. */
export function lisbonSlot(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const minute = Number(parts.minute) < 30 ? '00' : '30';
  return {
    weekday: WEEKDAY[parts.weekday!] ?? 0,
    time: `${parts.hour}:${minute}`,
    day: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

type Recipient = { id: string; email: string };

/**
 * Emails de resumo: melhores ofertas novas + lembretes de candidaturas paradas.
 * Corre de meia em meia hora; respeita dias/horas das preferências.
 */
@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);
  /** Fila de envios: se um lote demorar mais de 30 min, o seguinte espera em vez de se perder. */
  private queue: Promise<void> = Promise.resolve();

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly preferences: PreferencesService,
    private readonly match: MatchService,
    private readonly applications: ApplicationsService,
    private readonly jobs: JobsService,
    private readonly monitor: MonitorService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** De meia em meia hora: envia o resumo a quem o marcou para este dia e hora. */
  @Cron('0,30 * * * *', { timeZone: TZ })
  async tick() {
    const slot = lisbonSlot();
    const due: Recipient[] = [];
    for (const user of await this.users.find()) {
      if (!user.emailVerifiedAt) continue; // nunca enviar resumos para emails por confirmar
      const p = await this.preferences.get(user.id);
      if (p.dailyEmail && p.emailDays.includes(slot.weekday) && p.emailTimes.includes(slot.time)) due.push(user);
    }
    if (!due.length) return;
    this.logger.log(`${slot.time}: ${due.length} resumo(s) a enviar`);
    // um lock por dia+hora: se houver duas instâncias da API, só uma envia este lote
    const key = `radar:digest:${slot.day}:${slot.time}`;
    this.queue = this.queue
      .then(async () => {
        const r = await withLock(this.db, key, () => this.run(due));
        if (!r.ran) this.logger.log(`${slot.time}: outra instância já está a enviar este lote`);
      })
      .catch(() => {});
    await this.queue;
  }

  private async run(due: Recipient[]) {
    try {
      await this.jobs.syncIfStale(2 * HOUR); // ofertas frescas antes de avaliar
    } catch (err) {
      this.logger.warn(`Sync antes do resumo falhou: ${(err as Error).message}`);
    }
    const result = { sent: 0, skipped: 0, failed: 0, errors: [] as string[] };
    for (const user of due) {
      try {
        // sem CV ainda: não há o que avaliar, mas os lembretes de follow-up continuam a valer
        await this.match.matchPending(user.id).catch((err) => {
          // sem CV, ou já há uma análise a correr (em segundo plano): envia com o que já está avaliado
          if (!(err instanceof NotFoundException) && !(err instanceof ConflictException)) throw err;
        });
        const r = await this.sendFor(user);
        if (r.sent) result.sent++;
        else result.skipped++;
      } catch (err) {
        result.failed++;
        result.errors.push((err as Error).message);
        this.logger.warn(`Resumo falhou para o utilizador ${user.id}: ${(err as Error).message}`);
      }
    }
    this.monitor.digestRun(result);
  }

  /**
   * Monta e envia o resumo de um utilizador. Não envia se não houver nada.
   * Automático: só ofertas novas desde o último envio. Manual (teste): as das últimas 24h.
   */
  async sendFor(user: Recipient, { manual = false } = {}) {
    const prefs = await this.preferences.get(user.id);
    const now = new Date();
    const last = manual ? null : await this.preferences.lastDigestAt(user.id);
    const since = Math.max(last?.getTime() ?? 0, now.getTime() - (last ? 7 * DAY : DAY));

    const fresh = (await this.match.list(user.id, new Date(since))).filter(
      (m) => m.createdAt.getTime() >= since && m.score >= prefs.digestMinScore && !m.decision,
    );
    const matches = fresh.slice(0, prefs.emailMaxJobs); // a lista já vem ordenada pela nota
    // lembretes de follow-up só no primeiro email do dia, para não repetir
    const firstToday = manual || !last || lisbonSlot(last).day !== lisbonSlot(now).day;
    const stale = firstToday ? (await this.applications.list(user.id)).filter((a) => a.stale) : [];
    if (!matches.length && !stale.length) return { sent: false, matches: 0, stale: 0 };

    const appUrl = (this.config.get<string>('WEB_URL') ?? 'http://localhost:3000').replace(/\/+$/, '');
    const email = (
      <DigestEmail
        appUrl={appUrl}
        dateLabel={dateLabel(now)}
        more={fresh.length - matches.length}
        jobs={matches.map((m) => ({
          title: m.job.title, company: m.job.company, location: m.job.location,
          workModel: m.job.workModel ? (MODEL_PT[m.job.workModel] ?? null) : null,
          salary: salaryLabel(m.job.salaryMin, m.job.salaryMax),
          url: m.job.url, score: m.score, reasons: m.reasons,
        }))}
        stale={stale.map((a) => ({
          title: a.job.title, company: a.job.company, url: a.job.url,
          status: STATUS_PT[a.status] ?? a.status,
          days: Math.floor((now.getTime() - a.updatedAt.getTime()) / DAY),
        }))}
      />
    );
    const [html, text] = await Promise.all([render(email), render(email, { plainText: true })]);

    const subject =
      `Radar: ${matches.length} oferta${matches.length === 1 ? '' : 's'} nova${matches.length === 1 ? '' : 's'}` +
      (stale.length ? `, ${stale.length} follow-up${stale.length === 1 ? '' : 's'}` : '');
    await this.mail.send(user.email, subject, html, {
      text,
      headers: { 'List-Unsubscribe': `<${appUrl}/perfil#emails>` },
    });
    if (!manual) await this.preferences.markDigestSent(user.id, now);
    return { sent: true, matches: matches.length, stale: stale.length };
  }
}
