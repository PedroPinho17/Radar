import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, LessThan, Repository } from 'typeorm';
import { withLock } from '../common/db-lock.js';
import { EmailVerification } from '../auth/email-verification.entity.js';
import { PasswordReset } from '../auth/password-reset.entity.js';
import { Session } from '../auth/session.entity.js';
import { User } from '../auth/user.entity.js';
import { Application } from '../jobs/application.entity.js';
import { Match } from '../jobs/match.entity.js';
import { Preferences } from '../profile/preferences.entity.js';
import { Profile } from '../profile/profile.entity.js';
import { Feedback } from './feedback.entity.js';

const DAY = 24 * 60 * 60 * 1000;
/** Contas que nunca confirmaram o email são apagadas ao fim de… */
const UNVERIFIED_DAYS = 7;
/** Ofertas antigas sem interesse para ninguém são apagadas ao fim de… */
const JOB_DAYS = 60;

/**
 * Conta do utilizador: exportação RGPD, onboarding e limpeza diária de dados velhos.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    @InjectRepository(Preferences) private readonly prefs: Repository<Preferences>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    @InjectRepository(Application) private readonly apps: Repository<Application>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(PasswordReset) private readonly resets: Repository<PasswordReset>,
    @InjectRepository(EmailVerification) private readonly verifications: Repository<EmailVerification>,
    @InjectRepository(Feedback) private readonly feedback: Repository<Feedback>,
  ) {}

  /** RGPD (direito de acesso e portabilidade): tudo o que guardamos sobre a pessoa, em JSON. */
  async export(userId: string) {
    const [account, profile, preferences, matches, applications, feedback] = await Promise.all([
      this.users.findOneBy({ id: userId }),
      this.profiles.findOneBy({ userId }),
      this.prefs.findOneBy({ userId }),
      this.matches.find({ where: { userId }, relations: { job: true }, order: { createdAt: 'DESC' } }),
      this.apps.find({ where: { userId }, relations: { job: true, events: true }, order: { createdAt: 'DESC' } }),
      this.feedback.find({ where: { userId }, order: { createdAt: 'DESC' } }),
    ]);
    const job = (j: { title: string; company: string; location: string | null; url: string; source: string }) => ({
      title: j.title, company: j.company, location: j.location, url: j.url, source: j.source,
    });
    const strip = <T extends object>(o: T | null, ...keys: string[]) =>
      o && Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

    return {
      exportedAt: new Date().toISOString(),
      note: 'Dados guardados pelo Radar sobre ti. O PDF do CV não é guardado: só o resumo que a IA extraiu dele.',
      account: account && {
        email: account.email,
        createdAt: account.createdAt,
        emailVerifiedAt: account.emailVerifiedAt,
        termsAcceptedAt: account.termsAcceptedAt,
      },
      profile: strip(profile, 'userId', 'user'),
      preferences: strip(preferences, 'userId', 'user'),
      matches: matches.map((m) => ({
        job: job(m.job), score: m.score, reasons: m.reasons, missingSkills: m.missingSkills,
        decision: m.decision, decisionReason: m.decisionReason, coverLetter: m.coverLetter, createdAt: m.createdAt,
      })),
      applications: applications.map((a) => ({
        job: job(a.job), status: a.status, createdAt: a.createdAt, updatedAt: a.updatedAt,
        events: a.events.map((e) => ({ status: e.status, note: e.note, createdAt: e.createdAt })),
      })),
      feedback: feedback.map((f) => ({ type: f.type, message: f.message, page: f.page, createdAt: f.createdAt })),
    };
  }

  /** Primeiros passos: email → áreas → perfil (CV ou formulário) → preferências. */
  async onboarding(user: { id: string; emailVerified: boolean }) {
    const [hasProfile, prefs, hasMatches] = await Promise.all([
      this.profiles.existsBy({ userId: user.id }),
      this.prefs.findOne({
        where: { userId: user.id },
        select: { userId: true, roles: true, areas: true, district: true, city: true, onsiteLocations: true },
      }),
      this.matches.existsBy({ userId: user.id }),
    ]);
    const hasAreas = !!(prefs?.areas?.length);
    const hasPlace = !!(prefs?.district || prefs?.city || prefs?.onsiteLocations?.length);
    const hasPreferences = !!(prefs?.roles?.length || hasPlace);
    const steps = {
      emailVerified: user.emailVerified,
      hasAreas,
      hasProfile,
      hasPreferences,
      // compat com o frontend antigo
      hasCv: hasProfile,
    };
    return {
      ...steps,
      hasMatches,
      done: steps.emailVerified && hasAreas && hasProfile && hasPreferences,
    };
  }

  /** Todos os dias às 3h30: apaga o que já não é preciso (minimização de dados, RGPD). */
  @Cron('30 3 * * *', { timeZone: 'Europe/Lisbon' })
  async cleanup() {
    await withLock(this.db, 'radar:cleanup', () => this.runCleanup());
  }

  private async runCleanup() {
    const now = Date.now();
    try {
      const unverified = await this.users.delete({
        emailVerifiedAt: IsNull(),
        createdAt: LessThan(new Date(now - UNVERIFIED_DAYS * DAY)),
      });
      const expired = new Date();
      await this.sessions.delete({ expiresAt: LessThan(expired) });
      await this.resets.delete({ expiresAt: LessThan(expired) });
      await this.verifications.delete({ expiresAt: LessThan(expired) });

      // ofertas velhas que ninguém marcou nem usou numa candidatura (os matches sem decisão vão em cascata)
      const [, jobs] = (await this.db.query(
        `DELETE FROM jobs j
          WHERE j."createdAt" < $1
            AND NOT EXISTS (SELECT 1 FROM applications a WHERE a."jobId" = j.id)
            AND NOT EXISTS (SELECT 1 FROM matches m WHERE m."jobId" = j.id AND m.decision IS NOT NULL)`,
        [new Date(now - JOB_DAYS * DAY)],
      )) as [unknown, number];

      this.logger.log(`Limpeza: ${unverified.affected ?? 0} contas por confirmar, ${jobs ?? 0} ofertas antigas`);
    } catch (err) {
      this.logger.error('Falha na limpeza diária', err as Error);
    }
  }
}
