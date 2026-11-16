import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NewJob } from './itjobs.service.js';
import { htmlToText } from './html.js';

type JoobleJob = {
  id: number | string;
  title: string;
  location?: string;
  snippet?: string;
  salary?: string;
  source?: string;
  type?: string;
  link: string;
  company?: string;
  updated?: string;
};

/**
 * Jooble: agregador com ofertas de todas as áreas em Portugal.
 * Só liga se existir JOOBLE_API_KEY (chave gratuita em https://jooble.org/api/about).
 */
@Injectable()
export class JoobleService {
  private readonly key?: string;
  private readonly url: string;

  constructor(config: ConfigService) {
    this.key = config.get<string>('JOOBLE_API_KEY') || undefined;
    this.url = (config.get<string>('JOOBLE_API_URL') ?? 'https://jooble.org/api/').replace(/\/?$/, '/');
  }

  /** `false` se não houver `JOOBLE_API_KEY` — o sync salta esta fonte. */
  get enabled() {
    return !!this.key;
  }

  /**
   * Pesquisa cada termo na localização dada (cidade, distrito ou "Portugal").
   * Pausa entre pedidos para não martelar a API.
   */
  async search(terms: string[], location = 'Portugal'): Promise<NewJob[]> {
    if (!this.key) return [];
    const jobs: NewJob[] = [];
    for (const keywords of terms) {
      const res = await fetch(`${this.url}${this.key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'radar-app' },
        body: JSON.stringify({ keywords, location, page: '1' }),
      });
      if (!res.ok) throw new Error(`Jooble respondeu ${res.status}.`);
      const data = (await res.json()) as { jobs?: JoobleJob[] };
      jobs.push(...(data.jobs ?? []).filter((j) => j.link && j.title).map((j) => this.toJob(j)));
      await new Promise((r) => setTimeout(r, 400));
    }
    return jobs;
  }

  private toJob(j: JoobleJob): NewJob {
    const title = htmlToText(j.title);
    const text = `${title} ${j.type ?? ''}`;
    return {
      source: 'jooble',
      externalId: String(j.id),
      area: null, // área vem do contexto da pesquisa; o filtro usa título/funções
      title,
      company: htmlToText(j.company) || 'Desconhecida',
      location: j.location?.trim() || null,
      workModel: /h[ií]brid|hybrid/i.test(text) ? 'hybrid' : /remot/i.test(text) ? 'remote' : null,
      description: htmlToText(j.snippet) || title,
      url: j.link,
      publishedAt: j.updated && !Number.isNaN(Date.parse(j.updated)) ? new Date(j.updated) : null,
      salaryMin: null,
      salaryMax: null,
    };
  }
}
