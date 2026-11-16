import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { GoogleGenAI } from '@google/genai';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { Profile } from './profile.entity.js';
import { GithubService } from './github.service.js';
import { PreferencesService, type PreferencesData } from './preferences.service.js';
import { AREAS, IT_EXCLUDES, TECH, toArea } from './sectors.js';

const profileSchema = z.object({
  title: z.string().min(1),
  yearsExperience: z.number().int().min(0).max(60),
  seniority: z.enum(['junior', 'mid', 'senior']),
  skills: z.array(z.string()).max(60),
  languages: z.array(z.string()).max(10),
  location: z.string().nullable(),
  summary: z.string().max(1000),
  sector: z.string().transform((s) => toArea(s) ?? 'Outra'),
  jobTitles: z.array(z.string().trim().min(2).max(60)).max(15).catch([]),
});
export type ProfileData = z.infer<typeof profileSchema>;

const formSchema = z.object({
  title: z.string().trim().min(2).max(80),
  yearsExperience: z.number().int().min(0).max(60),
  education: z.string().trim().min(1).max(120).nullable().optional(),
  drivingLicense: z.string().trim().max(40).nullable().optional(), // "B", "sem", etc.
  location: z.string().trim().min(1).max(80).nullable().optional(),
  summary: z.string().trim().max(1000).nullable().optional(),
  skills: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
  languages: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  area: z.enum(AREAS).optional(),
  areas: z.array(z.enum(AREAS)).max(AREAS.length).optional(),
  roles: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  district: z.string().trim().min(1).max(60).nullable().optional(),
  city: z.string().trim().min(1).max(60).nullable().optional(),
  maxDistanceKm: z.number().int().min(1).max(500).nullable().optional(),
  shifts: z.array(z.string()).max(10).optional(),
  contractTypes: z.array(z.string()).max(10).optional(),
  workTime: z.enum(['full_time', 'part_time', 'ambos']).nullable().optional(),
});

const PROMPT = `You receive up to three sources about the same person, who may work in ANY profession
(e.g. software developer, nursery assistant, cook, truck driver, nurse, accountant):
1) their CV (PDF), 2) optionally their LinkedIn profile export (PDF),
3) optionally a JSON list of their GitHub repositories (repos with "academic": true are university coursework).
Merge them and return ONLY a JSON object with this exact shape:
{"title": string, "yearsExperience": number, "seniority": "junior"|"mid"|"senior",
 "skills": string[], "languages": string[], "location": string|null, "summary": string,
 "sector": string, "jobTitles": string[]}
Rules:
- The CV is the main source. Use LinkedIn and GitHub to complete it, not to contradict it.
- title: the person's current or target job title, in the language the CV uses.
- sector: exactly one of ${AREAS.map((s) => `"${s}"`).join(', ')}.
  Use "Informática" only for software/IT roles (developers, data, DevOps, IT support…).
- jobTitles: 6 to 12 job titles this person would search for on Portuguese job boards, written exactly as
  they appear in Portuguese job ads (pt-PT), most relevant first. Include common synonyms and variants
  (e.g. for a nursery assistant: "Auxiliar de Ação Educativa", "Ajudante de Ação Educativa",
  "Assistente Operacional", "Auxiliar de Creche"; for a developer: "Programador", "Backend Developer",
  "Full Stack Developer"; for a finance director: "Diretor Financeiro", "Diretor Administrativo e Financeiro",
  "CFO", "Controller Financeiro"). Match the person's level: management/director titles for managers and
  directors, team-lead titles ("Encarregado", "Chefe de Equipa") for supervisors, entry titles for beginners.
  English titles only when the field normally uses them (e.g. IT, multinationals).
  Short titles (1-4 words), no company names, no words like "Sénior"/"Júnior".
- skills: the professional skills relevant for jobs in their field, deduplicated, using the names
  employers use in job ads. For IT: technologies with official names ("SQL Server", "Node.js", "REST APIs").
  For other fields: practical skills, certifications and licences (e.g. "Primeiros Socorros",
  "HACCP", "Carta de Condução B", "Curso de Auxiliar de Ação Educativa"). No generic soft skills.
  If there are non-academic GitHub repos, include their languages and frameworks; academic-only skills last.
- yearsExperience: count only paid professional jobs. Do NOT count internships
  ("estágio", "internship"), curricular placements, education, volunteering or personal projects.
  Round down to whole years.
- languages: spoken languages, always in English (e.g. "Portuguese", "English").
- summary: in Portuguese (pt-PT), written in the first person, max 3 sentences.
- Do not invent anything that is not in the sources. Use null when unknown.`;

/**
 * Perfil profissional: extrai do CV (Gemini) ou grava a partir do formulário sem PDF.
 * Na primeira vez, preenche preferências (área/funções) sem apagar o que a pessoa já escolheu.
 */
@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);
  private readonly ai: GoogleGenAI;
  private readonly models: string[];

  constructor(
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    config: ConfigService,
    private readonly githubService: GithubService,
    private readonly preferences: PreferencesService,
  ) {
    this.ai = new GoogleGenAI({
      apiKey: config.getOrThrow<string>('GEMINI_API_KEY'),
      httpOptions: { timeout: 20_000 },
    });
    this.models = [config.getOrThrow<string>('GEMINI_MODEL'), config.get<string>('GEMINI_FALLBACK_MODEL')]
      .filter((m): m is string => !!m);
  }

  /** Pede à IA (Gemini) um JSON de perfil a partir do PDF; tenta o modelo de fallback se falhar. */
  async extract(cv: Buffer, linkedin?: Buffer, githubUser?: string | null): Promise<ProfileData> {
    const repos = githubUser ? await this.githubService.repos(githubUser).catch(() => []) : [];
    const pdf = (b: Buffer) => ({ inlineData: { mimeType: 'application/pdf', data: b.toString('base64') } });
    const parts = [
      pdf(cv),
      ...(linkedin ? [pdf(linkedin)] : []),
      ...(repos.length ? [{ text: `GitHub repositories:\n${JSON.stringify(repos)}` }] : []),
      { text: PROMPT },
    ];
    let lastError: unknown;
    for (const model of this.models) {
      try {
        const res = await this.ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: { responseMimeType: 'application/json', temperature: 0.1 },
        });
        return profileSchema.parse(JSON.parse(res.text ?? ''));
      } catch (err) {
        lastError = err;
      }
    }
    this.logger.error('Falha ao analisar o perfil', lastError as Error);
    throw new BadGatewayException('Não foi possível analisar o perfil. Tenta outra vez.');
  }

  /** Extrai o CV, guarda o perfil e, se as preferências estiverem vazias, preenche área/funções. */
  async saveFromCv(userId: string, cv: Buffer, linkedin?: Buffer): Promise<Profile> {
    const prefs = await this.preferences.get(userId);
    const { jobTitles, ...data } = await this.extract(cv, linkedin, prefs.githubUsername);
    await this.profiles.save({
      userId,
      ...data,
      suggestedRoles: jobTitles,
      education: null,
      drivingLicense: null,
      source: 'cv',
    });

    const patch: Partial<PreferencesData> = {};
    if (!prefs.areas.length) {
      patch.areas = [data.sector];
      patch.sector = data.sector;
      if (data.sector === TECH && !prefs.excludeKeywords.length) patch.excludeKeywords = IT_EXCLUDES;
    }
    if (!prefs.roles.length && jobTitles.length) patch.roles = jobTitles.slice(0, 10);
    if (Object.keys(patch).length) await this.preferences.update(userId, patch);

    return this.get(userId);
  }

  /** Perfil sem CV: formulário simples + actualiza preferências relacionadas. */
  async saveFromForm(userId: string, body: unknown): Promise<Profile> {
    const parsed = formSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map((i) => i.message).join(' '));
    const f = parsed.data;
    const areas = f.areas?.length ? f.areas : f.area ? [f.area] : [];
    if (!areas.length) throw new BadRequestException('Escolhe pelo menos uma área profissional.');

    const years = f.yearsExperience;
    const seniority = years >= 5 ? 'senior' : years >= 2 ? 'mid' : 'junior';
    const skills = f.skills ?? [];
    if (f.drivingLicense && f.drivingLicense !== 'sem') {
      const label = `Carta de Condução ${f.drivingLicense}`;
      if (!skills.some((s) => s.toLowerCase().includes('carta'))) skills.push(label);
    }

    await this.profiles.save({
      userId,
      title: f.title,
      yearsExperience: years,
      seniority,
      skills,
      languages: f.languages?.length ? f.languages : ['Portuguese'],
      location: f.location ?? f.city ?? f.district ?? null,
      summary: f.summary?.trim() || `Procuro trabalho como ${f.title}.`,
      sector: areas[0],
      suggestedRoles: f.roles ?? [],
      education: f.education ?? null,
      drivingLicense: f.drivingLicense ?? null,
      source: 'form',
    });

    const prefsPatch: Partial<PreferencesData> = {
      areas,
      sector: areas[0],
    };
    if (f.roles?.length) prefsPatch.roles = f.roles;
    if (f.district !== undefined) prefsPatch.district = f.district;
    if (f.city !== undefined) prefsPatch.city = f.city;
    if (f.maxDistanceKm !== undefined) prefsPatch.maxDistanceKm = f.maxDistanceKm;
    if (f.shifts) prefsPatch.shifts = f.shifts as PreferencesData['shifts'];
    if (f.contractTypes) prefsPatch.contractTypes = f.contractTypes as PreferencesData['contractTypes'];
    if (f.workTime !== undefined) prefsPatch.workTime = f.workTime;
    if (areas.includes(TECH)) {
      const prefs = await this.preferences.get(userId);
      if (!prefs.excludeKeywords.length) prefsPatch.excludeKeywords = IT_EXCLUDES;
    }
    await this.preferences.update(userId, prefsPatch);

    return this.get(userId);
  }

  async get(userId: string): Promise<Profile> {
    const profile = await this.profiles.findOneBy({ userId });
    if (!profile) throw new NotFoundException('Ainda não criaste o teu perfil (CV ou formulário).');
    return profile;
  }
}
