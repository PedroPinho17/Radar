import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { withLock } from '../common/db-lock.js';
import { Cron } from '@nestjs/schedule';
import { Job } from './job.entity.js';
import { ItjobsService, type NewJob } from './itjobs.service.js';
import { LandingService } from './landing.service.js';
import { NetEmpregosService } from './netempregos.service.js';
import { WwrService } from './wwr.service.js';
import { passesFilters } from './job-filters.js';
import { PreferencesService, type PreferencesData } from '../profile/preferences.service.js';
import { TECH, type Area, isTech, toArea } from '../profile/sectors.js';
import { JoobleService } from './jooble.service.js';
import { MonitorService } from '../mail/monitor.service.js';
import { joobleQueries, keywordsForAreas, netEmpregosCategoriesFor, netEmpregosPairs } from './area-sources.js';

/** Máximo de pesquisas por sync em cada fonte de pesquisa (para não martelar os sites). */
const MAX_TERMS = 30;

/** Funções mais pedidas entre todos os utilizadores (sem duplicados, ignorando acentos). */
function topTerms(prefs: PreferencesData[], max = MAX_TERMS) {
  const count = new Map<string, { term: string; n: number }>();
  for (const role of prefs.flatMap((p) => p.roles)) {
    const key = role.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
    const hit = count.get(key) ?? { term: role.trim(), n: 0 };
    hit.n++;
    count.set(key, hit);
  }
  return [...count.values()].sort((a, b) => b.n - a.n).slice(0, max).map((x) => x.term);
}

/** União das áreas de todos os utilizadores (com mapeamento do `sector` legado). */
function allAreas(prefs: PreferencesData[]): Area[] {
  const set = new Set<Area>();
  for (const p of prefs) {
    if (p.areas.length) {
      p.areas.forEach((a) => set.add(a));
    } else {
      const mapped = toArea(p.sector);
      if (mapped) set.add(mapped);
      else if (isTech(p.areas, p.sector)) set.add(TECH);
    }
  }
  return [...set];
}

/**
 * Sincroniza ofertas das várias fontes (cron + pedidos manuais) e guarda-as em `jobs`.
 * Escolhe fontes conforme as áreas dos utilizadores; uma sync de cada vez (lock).
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    private readonly itjobs: ItjobsService,
    private readonly landing: LandingService,
    private readonly netEmpregos: NetEmpregosService,
    private readonly wwr: WwrService,
    private readonly preferences: PreferencesService,
    private readonly jooble: JoobleService,
    private readonly monitor: MonitorService,
  ) {}

  private lastSyncAt = 0;
  private running: ReturnType<JobsService['lockedSync']> | null = null;

  onApplicationBootstrap() {
    if (process.env.SYNC_ON_BOOT === 'false') return;
    void this.dailySync();
  }

  /** Dispara (ou junta-se a) um sync: pedidos em paralelo partilham o mesmo trabalho. */
  sync() {
    this.running ??= this.lockedSync().finally(() => (this.running = null));
    return this.running;
  }

  private async lockedSync() {
    const r = await withLock(this.db, 'radar:sync', () => this.runSync());
    if (r.ran) return r.value;
    this.logger.log('Sync saltado: outra instância já está a sincronizar');
    return { found: 0, perSource: {} as Record<string, number | string>, inserted: 0, skipped: true };
  }

  /** Só faz sync se o último com sucesso foi há mais de `maxAgeMs` (ex.: antes dos emails). */
  async syncIfStale(maxAgeMs: number) {
    if (Date.now() - this.lastSyncAt > maxAgeMs) await this.sync();
  }

  /**
   * Fontes conforme as áreas dos utilizadores:
   * - ITJobs, Landing, WWR e NE/Informática só se houver Informática;
   * - Net-Empregos por categorias das áreas escolhidas;
   * - Jooble com keywords + localização.
   */
  private async plan() {
    const all = await this.preferences.all();
    const areas = allAreas(all);
    const wantsIt = !all.length || areas.includes(TECH) || all.some((p) => isTech(p.areas, p.sector));
    const sources: Record<string, () => Promise<NewJob[]>> = {};
    const known = () => this.knownIds('netempregos');

    if (wantsIt) {
      sources.itjobs = () => this.itjobs.fetchLatest();
      sources.landing = () => this.landing.fetchLatest();
      sources.wwr = () => this.wwr.fetchLatest();
    }

    // categorias das áreas de cada pessoa, NO distrito dela (sem utilizadores: Informática no país todo)
    const nePairs = all.length
      ? netEmpregosPairs(all)
      : netEmpregosCategoriesFor([TECH]).map((categoryId) => ({ categoryId, zoneId: 0 }));
    if (nePairs.length) {
      sources.netempregos = async () => this.netEmpregos.fetchPairs(nePairs, await known());
    }

    const nonIt = all.filter((p) => !isTech(p.areas, p.sector));
    const otherRoles = topTerms(nonIt);
    const otherAreas = allAreas(nonIt).filter((a) => a === 'Outra' || a !== TECH);
    if (otherRoles.length || otherAreas.includes('Outra')) {
      const terms = otherRoles.length ? otherRoles : keywordsForAreas(['Outra'], []).slice(0, 5);
      if (terms.length) {
        sources['netempregos (pesquisa)'] = async () =>
          this.netEmpregos.search(terms.slice(0, MAX_TERMS), await known(), 2, 'Outra');
      }
    }

    // Jooble: cada pessoa na sua zona (antes era só a zona mais comum de todas)
    if (this.jooble.enabled && all.length) {
      const queries = joobleQueries(all, MAX_TERMS);
      if (queries.length) {
        sources.jooble = async () => {
          const found: NewJob[] = [];
          for (const { terms, location } of queries) found.push(...(await this.jooble.search(terms, location)));
          return found;
        };
      }
    }

    return sources;
  }

  private async runSync() {
    const sources = await this.plan();
    const perSource: Record<string, number | string> = {};
    const byKey = new Map<string, NewJob>();

    for (const [name, fetchJobs] of Object.entries(sources)) {
      try {
        const jobs = await fetchJobs();
        jobs.forEach((j) => byKey.set(`${j.source}:${j.externalId}`, j));
        perSource[name] = jobs.length;
        this.monitor.source(name, { count: jobs.length });
      } catch (err) {
        perSource[name] = `erro: ${(err as Error).message}`;
        this.monitor.source(name, { error: (err as Error).message });
        this.logger.warn(`Sync ${name} falhou: ${(err as Error).message}`);
      }
    }

    const found = [...byKey.values()];
    const before = await this.jobs.count();
    if (found.length) {
      await this.jobs
        .createQueryBuilder()
        .insert()
        .values(found)
        .orUpdate(
          ['title', 'company', 'location', 'workModel', 'description', 'salaryMin', 'salaryMax', 'area'],
          ['source', 'externalId'],
        )
        .execute();
    }
    this.lastSyncAt = Date.now();
    this.monitor.syncFinished();
    return { found: found.length, perSource, inserted: (await this.jobs.count()) - before };
  }

  list() {
    return this.jobs.find({ order: { publishedAt: 'DESC' }, take: 50 });
  }

  @Cron('0 8 * * *', { timeZone: 'Europe/Lisbon' })
  async dailySync() {
    try {
      const r = await this.sync();
      this.logger.log(`Sync: ${JSON.stringify(r.perSource)}, ${r.inserted} novas`);
    } catch (err) {
      this.logger.error('Falha no sync diário', err as Error);
    }
  }

  async filtered(userId: string) {
    const prefs = await this.preferences.get(userId);
    const all = await this.jobs.find({ order: { publishedAt: 'DESC' } });
    const kept = all.filter((j) => passesFilters(j, prefs));
    return { total: all.length, kept: kept.length, jobs: kept };
  }

  private async knownIds(source: string) {
    const rows = await this.jobs.find({ where: { source }, select: { externalId: true } });
    return new Set(rows.map((r) => r.externalId));
  }
}
