import { Injectable } from '@nestjs/common';
import type { NewJob } from './itjobs.service.js';
import { htmlToText } from './html.js';

type LandingJob = {
  id: number;
  title: string;
  url: string; // https://landing.jobs/at/<empresa>/<oferta>
  remote: boolean;
  role_description: string | null;
  main_requirements: string | null;
  nice_to_have: string | null;
  published_at: string;
  currency_code: string | null;
  gross_salary_low: number | null;
  gross_salary_high: number | null;
  locations?: { city: string; country_code: string }[]; // ofertas remotas às vezes não trazem
};

const PAGE = 50;

/** Fonte Landing.jobs (API) — ofertas tech; só para Informática. */
@Injectable()
export class LandingService {
  async fetchLatest(pages = 6): Promise<NewJob[]> {
    const jobs: NewJob[] = [];
    for (let page = 0; page < pages; page++) {
      const res = await fetch(`https://landing.jobs/api/v1/jobs?limit=${PAGE}&offset=${page * PAGE}`, {
        headers: { 'User-Agent': 'radar-app' },
      });
      if (!res.ok) throw new Error(`Landing.jobs respondeu ${res.status}.`);
      const data = (await res.json()) as LandingJob[];
      jobs.push(
        ...data
          .filter((j) => j.remote || (j.locations ?? []).some((l) => l.country_code === 'PT')) // só PT ou remoto
          .map((j) => this.toJob(j)),
      );
      if (data.length < PAGE) break;
    }
    return jobs;
  }

  private toJob(j: LandingJob): NewJob {
    const eur = j.currency_code === 'EUR'; // salários noutra moeda não comparam com os teus
    return {
      source: 'landing',
      externalId: String(j.id),
      area: 'Informática',
      title: j.title,
      company: this.companyFromUrl(j.url),
      location: (j.locations ?? []).map((l) => l.city).join(', ') || null,
      workModel: j.remote ? 'remote' : null, // a Landing não distingue presencial de híbrido
      description: [j.role_description, j.main_requirements, j.nice_to_have].map(htmlToText).join(' ').trim(),
      url: j.url,
      publishedAt: new Date(j.published_at),
      salaryMin: eur ? j.gross_salary_low : null,
      salaryMax: eur ? j.gross_salary_high : null,
    };
  }

  /** "https://landing.jobs/at/inscale/..." -> "Inscale" */
  private companyFromUrl(url: string) {
    const slug = url.match(/\/at\/([^/]+)\//)?.[1] ?? 'Desconhecida';
    return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}