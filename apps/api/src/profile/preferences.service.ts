import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { Preferences } from './preferences.entity.js';
import { AREAS, CONTRACT_TYPES, SHIFTS, TECH, WORK_TIMES, toArea } from './sectors.js';

/** Remove duplicados (ignorando maiúsculas/acentos) mantendo a ordem. */
const uniqueText = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter((s) => {
    const k = s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    return seen.has(k) ? false : (seen.add(k), true);
  });
};

const list = z.array(z.string().trim().min(1).max(60)).max(40).transform(uniqueText);
const salary = z.number().int().min(0).max(500000).nullable();

const preferencesSchema = z.object({
  areas: z.array(z.enum(AREAS)).max(AREAS.length).transform((a) => [...new Set(a)]),
  /** @deprecated */
  sector: z.string().nullable().optional(),
  currentSalary: salary,
  targetSalaryMin: salary,
  targetSalaryMax: salary,
  roles: z.array(z.string().trim().min(1).max(60)).max(20, 'No máximo 20 funções').transform(uniqueText),
  avoid: list,
  excludeKeywords: list,
  district: z.string().trim().min(1).max(60).nullable(),
  city: z.string().trim().min(1).max(60).nullable(),
  maxDistanceKm: z.number().int().min(1).max(500).nullable(),
  shifts: z.array(z.enum(SHIFTS)).max(SHIFTS.length).transform((a) => [...new Set(a)]),
  contractTypes: z.array(z.enum(CONTRACT_TYPES)).max(CONTRACT_TYPES.length).transform((a) => [...new Set(a)]),
  workTime: z.enum(WORK_TIMES).nullable(),
  onsiteLocations: list,
  hybridLocations: list,
  remoteAnywhere: z.boolean(),
  maxYears: z.number().int().min(0).max(30),
  notes: z.string().trim().max(1000).nullable(),
  githubUsername: z.string().trim().regex(/^[a-z\d](?:[a-z\d-]{0,38})$/i, 'Nome de GitHub inválido').nullable(),
  dailyEmail: z.boolean(),
  digestMinScore: z.number().int().min(0).max(100),
  emailDays: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .transform((d) => [...new Set(d)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))),
  emailTimes: z
    .array(z.string().regex(/^([01]\d|2[0-3]):(00|30)$/, 'Hora inválida (usa HH:00 ou HH:30)'))
    .min(1, 'Escolhe pelo menos uma hora para os emails')
    .max(6, 'No máximo 6 emails por dia')
    .transform((t) => [...new Set(t)].sort()),
  emailMaxJobs: z.number().int().min(1).max(50),
});
export type PreferencesData = z.infer<typeof preferencesSchema>;

/** Preferências por omissão (conta nova / ainda sem linha na BD). */
export const DEFAULT_PREFERENCES: PreferencesData = {
  currentSalary: null, targetSalaryMin: null, targetSalaryMax: null,
  areas: [], sector: null, roles: [], avoid: [],
  excludeKeywords: [],
  district: null, city: null, maxDistanceKm: null,
  shifts: [], contractTypes: [], workTime: null,
  onsiteLocations: [], hybridLocations: [], remoteAnywhere: true,
  maxYears: 3, notes: null, githubUsername: null,
  dailyEmail: true, digestMinScore: 60, emailDays: [1, 2, 3, 4, 5, 6, 0], emailTimes: ['08:30'], emailMaxJobs: 10,
};

function normalizeRow(row: Preferences): PreferencesData {
  const { userId: _u, user: _x, updatedAt: _d, lastDigestAt: _l, ...raw } = row;
  let areas = (raw.areas ?? []).map((a) => toArea(a) ?? a).filter(Boolean) as PreferencesData['areas'];
  if (!areas.length && raw.sector) {
    const mapped = toArea(raw.sector);
    if (mapped) areas = [mapped];
  }
  return {
    ...DEFAULT_PREFERENCES,
    ...raw,
    areas,
    sector: areas[0] ?? raw.sector ?? null,
    district: raw.district ?? null,
    city: raw.city ?? null,
    maxDistanceKm: raw.maxDistanceKm ?? null,
    shifts: (raw.shifts ?? []) as PreferencesData['shifts'],
    contractTypes: (raw.contractTypes ?? []) as PreferencesData['contractTypes'],
    workTime: (raw.workTime ?? null) as PreferencesData['workTime'],
  };
}

/**
 * Lê e actualiza preferências (áreas, locais, turnos, emails…).
 * Valida com Zod; normaliza `sector` legado → `areas`.
 */
@Injectable()
export class PreferencesService {
  constructor(@InjectRepository(Preferences) private readonly prefs: Repository<Preferences>) {}

  /** Preferências guardadas, ou {@link DEFAULT_PREFERENCES} se ainda não houver linha. */
  async get(userId: string): Promise<PreferencesData> {
    const saved = await this.prefs.findOneBy({ userId });
    if (!saved) return { ...DEFAULT_PREFERENCES };
    return normalizeRow(saved);
  }

  /**
   * Actualização parcial: só muda os campos enviados.
   * Converte `sector` legado → `areas`; exige distrito/cidade se não aceitar remoto em qualquer sítio.
   */
  async update(userId: string, body: unknown): Promise<PreferencesData> {
    const parsed = preferencesSchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map((i) => i.message).join(' '));
    const data = { ...parsed.data };
    // compat: se ainda mandarem sector sozinho, converte para areas
    if (data.sector && !data.areas) {
      const a = toArea(data.sector);
      if (a) data.areas = [a];
    }
    if (data.areas?.length) data.sector = data.areas[0];

    const next = { ...(await this.get(userId)), ...data };
    if (next.targetSalaryMin && next.targetSalaryMax && next.targetSalaryMin > next.targetSalaryMax)
      throw new BadRequestException('O salário mínimo pretendido não pode ser maior que o máximo.');
    if (next.dailyEmail && next.emailDays.length === 0)
      throw new BadRequestException('Escolhe pelo menos um dia para os emails (ou desliga-os).');

    // cidade/distrito alimentam onsiteLocations para o filtro de texto
    if (next.city && !next.onsiteLocations.some((l) => l.toLowerCase() === next.city!.toLowerCase())) {
      next.onsiteLocations = [...next.onsiteLocations, next.city];
    } else if (next.district && !next.city && !next.onsiteLocations.length) {
      next.onsiteLocations = [next.district];
    }
    if (!next.remoteAnywhere && !next.district && !next.city && !next.onsiteLocations.length) {
      throw new BadRequestException('Indica o distrito ou a cidade para trabalho presencial.');
    }

    await this.prefs.save({
      userId,
      ...next,
      sector: next.areas[0] ?? next.sector ?? null,
    });
    return this.get(userId);
  }

  /** Preferências de toda a gente (para decidir onde procurar ofertas). */
  async all(): Promise<PreferencesData[]> {
    return (await this.prefs.find()).map(normalizeRow);
  }

  async lastDigestAt(userId: string): Promise<Date | null> {
    const row = await this.prefs.findOne({ where: { userId }, select: { userId: true, lastDigestAt: true } });
    return row?.lastDigestAt ?? null;
  }

  async markDigestSent(userId: string, at: Date) {
    if (await this.prefs.existsBy({ userId })) await this.prefs.update({ userId }, { lastDigestAt: at });
    else await this.prefs.save({ userId, ...DEFAULT_PREFERENCES, lastDigestAt: at });
  }

  /** true se alguma preferência inclui Informática (ou lista vazia = legado IT). */
  static wantsTech(p: PreferencesData): boolean {
    if (p.areas.length) return p.areas.includes(TECH);
    return true;
  }
}
