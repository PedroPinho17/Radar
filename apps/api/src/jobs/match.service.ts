import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { DataSource, IsNull, MoreThan, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { withLock } from '../common/db-lock.js';
import { z } from 'zod';
import { Job } from './job.entity.js';
import { Match } from './match.entity.js';
import { passesFilters } from './job-filters.js';
import { ProfileService } from '../profile/profile.service.js';
import { PreferencesService, type PreferencesData } from '../profile/preferences.service.js';
import type { Profile } from '../profile/profile.entity.js';
import { MonitorService } from '../mail/monitor.service.js';
import { SalaryService } from './salary.service.js';
import { isTech } from '../profile/sectors.js';

/** Só se avaliam ofertas que entraram nos últimos N dias (as mais velhas já não interessam a ninguém). */
const RECENT_DAYS = 30;

/**
 * Alterna entre fontes (uma de cada vez) para a IA não ficar presa nas que têm
 * publishedAt sempre "hoje" (ex.: Net-Empregos) e deixar as outras por avaliar.
 * Dentro de cada fonte mantém a ordem recebida (mais recentes primeiro).
 */
export function interleaveBySource<T extends { source: string }>(jobs: T[], limit: number): T[] {
  const queues = new Map<string, T[]>();
  for (const job of jobs) {
    const q = queues.get(job.source);
    if (q) q.push(job);
    else queues.set(job.source, [job]);
  }
  const out: T[] = [];
  while (out.length < limit && queues.size > 0) {
    for (const source of Array.from(queues.keys())) { // cópia: apaga-se do mapa durante o ciclo
      if (out.length >= limit) break;
      const q = queues.get(source)!;
      out.push(q.shift()!);
      if (q.length === 0) queues.delete(source);
    }
  }
  return out;
}

const matchSchema = z.object({
  score: z.number().int().min(0).max(100),
  // "??" = acentos estragados algures: rejeita e pede a outro modelo
  reasons: z.array(z.string().refine((r) => !r.includes('??'), 'texto com acentos corrompidos')).transform((a) => a.slice(0, 5)),
  missingSkills: z.array(z.string()).transform((a) => a.slice(0, 10)),
  englishRequired: z.boolean(),
  minYears: z.number().int().min(0).max(20).nullable(),
  schedule: z.string().trim().max(80).nullable().catch(null),
  contractType: z.string().trim().max(80).nullable().catch(null),
});

export const decisionSchema = z.object({
  decision: z.enum(['like', 'dislike', 'applied']),
  reason: z.string().trim().max(300).optional(),
});

const letterSchema = z.object({
  language: z.enum(['pt', 'en']),
  letter: z.string().min(200).max(4000),
});

const LETTER_PROMPT = `You write short, plain-language cover letters for job applications in ANY profession
(cleaning, hospitality, childcare, healthcare, retail, logistics, office, IT, etc.).
Return ONLY a JSON object: {"language": "pt" | "en", "letter": string}
Rules:
- Write in the language of the job ad: European Portuguese (pt-PT, never Brazilian) or English.
- 2-3 short paragraphs, max 180 words, ready to paste. No placeholders like [Company].
- Simple everyday language. No jargon (no "stack", "backend", "synergy"). Adapt tone to the job.
- Use ONLY facts from CANDIDATE. Never invent experience, skills, years, certificates or results.
- Connect real experience to what the JOB asks for.
- If a required skill is missing, NEVER say the candidate is learning it (unless CANDIDATE notes say so). Leave it out or say once they are willing to learn.
- Never state availability for city, relocation, shifts or work model unless CANDIDATE says so.
- Honest and natural; no clichés like "I am writing to express my interest".
- End with a short closing and the candidate's name if known.
- Never state a language level (e.g. "fluent") unless CANDIDATE says it.
- Only mention facts in CANDIDATE; when in doubt, leave it out.
- Never claim knowledge of the company beyond the JOB text.
- Never qualify skills with strength words ("solid", "strong", "extensive", "expert", "sólidos").`;

// frases que a carta nunca pode ter; se aparecerem, pedimos outra
const BANNED: RegExp[] = [
  /\b(fluent|fluente(mente)?)\b/i,
  /\b(i am|i'm|estou a)\s+(currently\s+)?(learning|studying|aprender|estudar)\b/i,
  /\b(solid|strong|extensive|expert|s[óo]lid[oa]s?|profund[oa]s?)\b/i,
  /(available|dispon[íi]vel)[^.]{0,60}(hybrid|h[íi]brido|remote|remoto|on-site|presencial|relocat|lisboa|lisbon)/i,
];

const PROMPT = `You are a career assistant for ANY profession (cleaning, hospitality, childcare, healthcare,
retail, logistics, construction, office, IT, etc.). Compare the candidate with the job ad
and return ONLY a JSON object:
{"score": number, "reasons": string[], "missingSkills": string[], "englishRequired": boolean,
 "minYears": number | null, "schedule": string | null, "contractType": string | null}
Rules:
- score 0-100: how good a fit this job is for the candidate.
  90+ = excellent fit, 70-89 = good, 50-69 = possible, below 50 = poor.
- PREFERENCES describes what this candidate wants. Respect it:
  areas = professional fields (e.g. Educação/Creche, Restauração/Hotelaria, Informática).
  roles = job titles they want (score higher); if empty, judge by profile and areas.
  district/city = where they can work on-site; penalise far locations unless remote.
  shifts = preferred shifts (manha/tarde/noite/fins_semana); penalise conflicting schedules.
  workTime / contractTypes = full-time/part-time and contract preferences when stated.
  avoid = things they do not want (tasks, shifts, roles) — score much lower.
- A job outside the candidate's areas and roles is a poor fit (below 40).
- Penalise jobs that require clearly more experience than the candidate has.
- Also penalise jobs clearly BELOW the candidate's level (e.g. someone with 10+ years or a manager/director
  title offered an entry-level, assistant or trainee role), unless PREFERENCES or notes say they want it.
  Judge by the candidate's own field: a cleaning supervisor and an engineering director are both senior.
- reasons: 2-4 short reasons in European Portuguese (location, schedule, experience, requirements).
- missingSkills: REAL requirements from the ad the candidate lacks, as named in the ad
  (e.g. "Carta de condução B", "certificado de primeiros socorros", "experiência com crianças",
  "inglês", "HACCP"). NOT programming technologies unless the job is IT.
- englishRequired: true if the ad requires fluent/professional English.
- minYears: minimum years required (null if not stated). Senior/sénior without a number → 5.
- schedule: short label from the ad (e.g. "manhã", "turnos", "9h-18h", "fins de semana") or null.
- contractType: short label from the ad (e.g. "termo certo", "recibo verde", "full-time") or null.
- salary: compare with PREFERENCES (EUR gross/year).
  If max salary is below currentSalary, subtract 20. If overlaps targetSalaryMin-targetSalaryMax, add 5.
  If salary unknown, do not penalise.
- HISTORY (if present): learn from like/dislike/applied. Explicit reasons override general rules.`;

type Provider = { name: string; run: (text: string) => Promise<string> };

/**
 * Avaliação de ofertas pela IA (nota, motivos, faltas, horário/contrato) e cartas de apresentação.
 * Usa Gemini + Groq com fallback; uma análise de cada vez por utilizador (lock).
 */
@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);
  private readonly providers: Provider[];
  /** Pausa entre ofertas (não estourar o rate limit da IA) e antes de repetir após um 503. */
  private readonly delayMs: number;
  private readonly retryMs: number;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
    private readonly profiles: ProfileService,
    private readonly preferences: PreferencesService,
    private readonly monitor: MonitorService,
    private readonly salary: SalaryService,
    config: ConfigService,
  ) {
    this.delayMs = Number(config.get('AI_DELAY_MS') ?? 4000);
    this.retryMs = Number(config.get('AI_RETRY_MS') ?? 5000);
    const gemini = new GoogleGenAI({ apiKey: config.getOrThrow<string>('GEMINI_API_KEY') });
    const groq = new Groq({ apiKey: config.getOrThrow<string>('GROQ_API_KEY') });

    const viaGemini = (model: string): Provider => ({
      name: model,
      run: async (text) => {
        const res = await gemini.models.generateContent({
          model,
          contents: text,
          config: { responseMimeType: 'application/json', temperature: 0.1 },
        });
        return res.text ?? '';
      },
    });

    const viaGroq = (model: string): Provider => ({
      name: model,
      run: async (text) => {
        const res = await groq.chat.completions.create({
          model,
          messages: [{ role: 'user', content: text }],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        });
        return res.choices[0]?.message?.content ?? '';
      },
    });

    // ordem: principal -> rápido -> último recurso
    this.providers = [
      viaGemini(config.getOrThrow<string>('GEMINI_MODEL')),
      viaGroq(config.getOrThrow<string>('GROQ_MODEL')),
      viaGemini(config.getOrThrow<string>('GEMINI_FALLBACK_MODEL')),
    ];
  }

  /**
   * Avalia as ofertas filtradas que ainda não têm nota.
   * Uma análise de cada vez por utilizador (mesmo com várias instâncias da API): evita avaliar a dobrar.
   */
  async matchPending(userId: string, limit = 40) {
    const r = await withLock(this.db, `radar:match:${userId}`, () => this.scorePending(userId, limit));
    if (!r.ran) throw new ConflictException('Já há uma análise a decorrer para a tua conta. Espera uns minutos.');
    return r.value;
  }

  private async scorePending(userId: string, limit: number) {
    const profile = await this.profiles.get(userId);
    const prefs = await this.preferences.get(userId);
    const history = await this.history(userId);
    const done = new Set(
      (await this.matches.find({ where: { userId }, select: { jobId: true } })).map((m) => m.jobId),
    );
    const recent = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
    const pending = interleaveBySource(
      (await this.jobs.find({ where: { createdAt: MoreThan(recent) }, order: { publishedAt: 'DESC' } }))
        .filter((j) => passesFilters(j, prefs, profile.yearsExperience))
        .filter((j) => !done.has(j.id)),
      limit,
    );

    let scored = 0;
    let lastError: string | undefined;
    for (const job of pending) {
      try {
        const { model, ...result } = await this.score(profile, job, prefs, history);
        await this.matches.save({ userId, jobId: job.id, ...result });
        this.logger.log(`${job.title} -> ${result.score} (${model})`);
        scored++;
      } catch (err) {
        lastError = (err as Error).message;
        this.logger.warn(`Falhou o match de "${job.title}": ${lastError}`);
      }
      await new Promise((r) => setTimeout(r, this.delayMs)); // evita estourar o rate limit
    }
    this.monitor.aiRun(pending.length, scored, lastError);
    return { pending: pending.length, scored };
  }

  /** As tuas ofertas avaliadas, melhores primeiro. Com `since`, só as avaliadas desde essa data (resumos). */
  async list(userId: string, since?: Date) {
    const prefs = await this.preferences.get(userId);
    const where = since ? { userId, createdAt: MoreThanOrEqual(since) } : { userId };
    const all = await this.matches.find({ where, relations: { job: true }, order: { score: 'DESC' } });
    return all.filter((m) => m.minYears === null || m.minYears <= prefs.maxYears);
  }

  /**
   * Para o site: como `list`, mais o salário estimado (salary-predictor) nas ofertas que não o dizem.
   * Só para Informática (o modelo foi treinado com salários de IT). O email usa `list` e não paga este custo.
   */
  async listWithSalaries(userId: string) {
    const visible = await this.list(userId);
    if (!this.salary.enabled) return visible;
    const prefs = await this.preferences.get(userId);
    if (!isTech(prefs.areas, prefs.sector)) return visible;
    const profile = await this.profiles.get(userId).catch(() => null);
    if (!profile) return visible;
    return Promise.all(
      visible.map(async (m) => {
        const noSalary = !m.job.salaryMin && !m.job.salaryMax;
        const estimatedSalary = noSalary
          ? await this.salary.estimate(m.job.title, profile.yearsExperience, profile.skills)
          : null;
        return Object.assign(m, { estimatedSalary });
      }),
    );
  }

  /** Guarda o 👍/👎/candidatura do utilizador numa oferta. */
  async decide(userId: string, matchId: string, body: unknown) {
    const parsed = decisionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Decisão inválida: usa like, dislike ou applied');
    const { decision, reason } = parsed.data;
    const match = await this.matches.findOneBy({ id: matchId, userId }); // só podes decidir nos teus
    if (!match) throw new NotFoundException('Match não encontrado');
    match.decision = decision;
    match.decisionReason = reason ?? null;
    match.decidedAt = new Date();
    return this.matches.save(match);
  }

  /** Escreve (ou reescreve) a carta de apresentação para um match teu. */
  async coverLetter(userId: string, matchId: string, language?: 'pt' | 'en') {
    const match = await this.matches.findOne({ where: { id: matchId, userId }, relations: { job: true } });
    if (!match) throw new NotFoundException('Match não encontrado');
    const profile = await this.profiles.get(userId);
    const { githubUsername, notes } = await this.preferences.get(userId);

    const { user: _u, suggestedRoles: _s, userId: _id, updatedAt: _d, ...cv } = profile;
    const candidate = { ...cv, githubUsername, notes };
    const job = {
      title: match.job.title, company: match.job.company, location: match.job.location,
      description: match.job.description.slice(0, 6000),
    };
    const text =
      (language ? `\nWRITE IN: ${language === 'pt' ? 'European Portuguese (pt-PT)' : 'English'}\n` : '') +
      `${LETTER_PROMPT}\n\nCANDIDATE:\n${JSON.stringify(candidate)}\n\nJOB:\n${JSON.stringify(job)}` +
      '\n\nFINAL CHECK before answering: no language level (e.g. "fluent", "fluentemente") unless CANDIDATE states it; no "I am learning/studying X" unless CANDIDATE notes say so; no facts about the company that are not in JOB.';
        
    // cartas: qualidade > velocidade -> Gemini principal, Gemini fallback, só depois Groq
    const order = [this.providers[0], this.providers[2], this.providers[1]];
    let result = await this.ask(text, letterSchema, order);
    for (let i = 0; i < 2; i++) {
      const bad = BANNED.find((re) => re.test(result.letter));
      if (!bad) break;
      this.logger.warn(`Carta rejeitada (${bad.source}), a pedir outra`);
      result = await this.ask(text, letterSchema, order);
    }
    const { letter, language: detected, model } = result;

    match.coverLetter = letter;
    match.coverLetterAt = new Date();
    await this.matches.save(match);
    this.logger.log(`Carta para "${match.job.title}" (${detected}, ${model})`);
    return { matchId, language: detected, letter };
  }

  /** As tuas últimas 30 decisões, em formato curto para o prompt. */
  private async history(userId: string) {
    const decided = await this.matches.find({
      where: { userId, decision: Not(IsNull()) },
      relations: { job: true },
      order: { decidedAt: 'DESC' },
      take: 30,
    });
    return decided.map((m) => ({
      job: `${m.job.title} @ ${m.job.company}`,
      decision: m.decision,
      reason: m.decisionReason ?? undefined,
    }));
  }

  /** Pergunta à IA, tentando cada provider até um devolver JSON válido. */
  private async ask<T>(text: string, schema: z.ZodType<T>, providers = this.providers): Promise<T & { model: string }> {
    let lastError: unknown;
    for (const provider of providers) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const raw = await provider.run(text);
          return { ...schema.parse(JSON.parse(raw)), model: provider.name };
        } catch (err) {
          const msg = (err as Error).message;
          this.logger.debug(`${provider.name} falhou (tentativa ${attempt}): ${msg}`);
          lastError = err;
          if (attempt === 1 && /503|UNAVAILABLE|high demand/i.test(msg)) {
            await new Promise((r) => setTimeout(r, this.retryMs)); // pico temporário: espera e tenta outra vez
            continue;
          }
          break; // outro erro (JSON inválido, chave errada…) -> passa ao próximo provider
        }
      }
    }
    throw lastError;
  }

  private async score(profile: Profile, job: Job, prefs: PreferencesData, history: object[] = []) {
    const candidate = {
      title: profile.title, yearsExperience: profile.yearsExperience, seniority: profile.seniority,
      skills: profile.skills, languages: profile.languages, location: profile.location,
      education: profile.education ?? undefined,
      drivingLicense: profile.drivingLicense ?? undefined,
    };
    const ad = {
      title: job.title, company: job.company, location: job.location, workModel: job.workModel,
      area: job.area,
      salary: job.salaryMin || job.salaryMax
        ? `${job.salaryMin ?? '?'}-${job.salaryMax ?? '?'} EUR gross/year`
        : 'not stated',
      description: job.description.slice(0, 6000),
    };
    const preferences = {
      areas: prefs.areas, roles: prefs.roles, avoid: prefs.avoid, notes: prefs.notes,
      district: prefs.district, city: prefs.city, shifts: prefs.shifts,
      workTime: prefs.workTime, contractTypes: prefs.contractTypes,
      currentSalary: prefs.currentSalary, targetSalaryMin: prefs.targetSalaryMin, targetSalaryMax: prefs.targetSalaryMax,
    };
    let text = `${PROMPT}\n\nCANDIDATE:\n${JSON.stringify(candidate)}\n\nPREFERENCES:\n${JSON.stringify(preferences)}\n\nJOB:\n${JSON.stringify(ad)}`;
    if (history.length) text += `\n\nHISTORY:\n${JSON.stringify(history)}`;

    return this.ask(text, matchSchema);
  }
}