import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from './job.entity.js';
import { htmlToText } from './html.js';

type ItJob = {
  id: number;
  title: string;
  body: string;
  slug: string;
  workModel: number | null;
  publishedAt: string; // "2026-11-12 14:24:19"
  company: { name: string };
  locations?: { name: string }[];
  salaryMin: number | null;
  salaryMax: number | null;
};

/** Oferta pronta a inserir (sem `id` / `createdAt` da BD). */
export type NewJob = Omit<Job, 'id' | 'createdAt'>;

const WORK_MODEL = { 0: 'onsite', 1: 'remote', 2: 'hybrid' } as const;

/** Fonte ITJobs (API) — só para quem procura Informática. */
@Injectable()
export class ItjobsService {
  constructor(private readonly config: ConfigService) {}

  /** Últimas ofertas das páginas pedidas. */
  async fetchLatest(pages = 2): Promise<NewJob[]> {
    const key = this.config.getOrThrow<string>('ITJOBS_API_KEY');
    const jobs: NewJob[] = [];

    for (let page = 1; page <= pages; page++) {
      const res = await fetch(
        `https://api.itjobs.pt/job/list.json?api_key=${key}&limit=100&page=${page}`,
        { headers: { 'User-Agent': 'radar-app' } },
      );
      if (!res.ok) throw new Error(`ITJobs respondeu ${res.status}.`);
      const data = (await res.json()) as { results: ItJob[] };
      jobs.push(...data.results.map((j) => this.toJob(j)));
      if (data.results.length < 100) break; // não há mais páginas
    }
    return jobs;
  }

  private toJob(j: ItJob): NewJob {
    return {
      source: 'itjobs',
      externalId: String(j.id),
      area: 'Informática',
      title: j.title,
      company: j.company.name,
      location: j.locations?.map((l) => l.name).join(', ') || null,
      workModel: WORK_MODEL[j.workModel as keyof typeof WORK_MODEL] ?? null,
      description: htmlToText(j.body),
      url: `https://www.itjobs.pt/oferta/${j.id}/${j.slug}`,
      publishedAt: new Date(j.publishedAt.replace(' ', 'T')),
      salaryMin: j.salaryMin ?? null,
      salaryMax: j.salaryMax ?? null,
    };
  }
}