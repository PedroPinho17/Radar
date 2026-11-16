import { Injectable } from '@nestjs/common';
import type { NewJob } from './itjobs.service.js';
import { htmlToText } from './html.js';
import { areaFromNetEmpregosCategory } from './area-sources.js';
import type { Area } from '../profile/sectors.js';

const BASE = 'https://www.net-empregos.com';

/** O site lê os parâmetros em ISO-8859-1: "ação" tem de ir como %E7%E3o. */
function latin1Query(s: string) {
  return Array.from(s, (c) => {
    const code = c.charCodeAt(0);
    if (c === ' ') return '+';
    if (code < 128) return encodeURIComponent(c);
    return code <= 255 ? `%${code.toString(16).toUpperCase()}` : '';
  }).join('');
}

type Item = { id: string; url: string; title: string; date: string; zone: string; company: string };

/**
 * Cliente HTTP da Net-Empregos (HTML em ISO-8859-1).
 * Pesquisa por categoria/zona ou por palavras; salta ids já conhecidos e faz pausas entre pedidos.
 */
@Injectable()
export class NetEmpregosService {
  /** Compat: Informática (categoria 5). Preferir {@link fetchByCategories}. */
  async fetchLatest(known = new Set<string>(), pages = 5): Promise<NewJob[]> {
    return this.fetchByCategories([5], known, pages, 'Informática');
  }

  /** Ofertas das categorias dadas em todo o país (zona 0). */
  async fetchByCategories(
    categoryIds: number[],
    known = new Set<string>(),
    pages = 3,
    defaultArea?: Area | null,
  ): Promise<NewJob[]> {
    return this.fetchPairs(categoryIds.map((categoryId) => ({ categoryId, zoneId: 0 })), known, pages, defaultArea);
  }

  /**
   * Ofertas por pares (categoria, zona/distrito). Pedir por distrito faz aparecer as ofertas de Faro ou Viseu,
   * que no país inteiro ficavam enterradas atrás das de Lisboa e Porto. Ids conhecidos não voltam a ser abertos.
   */
  async fetchPairs(
    pairs: { categoryId: number; zoneId: number }[],
    known = new Set<string>(),
    pages = 2,
    defaultArea?: Area | null,
  ): Promise<NewJob[]> {
    const items = new Map<string, Item & { categoryId: number }>();
    for (const { categoryId, zoneId } of pairs) {
      for (let page = 1; page <= pages; page++) {
        const html = await this.get(
          `${BASE}/pesquisa-empregos.asp?page=${page}&categoria=${categoryId}&zona=${zoneId}&tipo=0`,
        );
        const found = this.parseList(html);
        if (page === 1 && !found.length && pairs.length === 1 && zoneId === 0) {
          throw new Error("não devolveu ofertas (bloqueio ou o site mudou).");
        }
        for (const item of found) {
          if (!known.has(item.id)) items.set(item.id, { ...item, categoryId });
        }
        if (found.length < 15) break;
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    return this.withDescriptions(items, defaultArea);
  }

  /** Pesquisa por palavras (qualquer área): uma pesquisa por função, todas as categorias e zonas. */
  async search(terms: string[], known = new Set<string>(), pagesPerTerm = 2, area: Area | null = 'Outra'): Promise<NewJob[]> {
    const items = new Map<string, Item & { categoryId: number }>();
    for (const term of terms) {
      for (let page = 1; page <= pagesPerTerm; page++) {
        const html = await this.get(
          `${BASE}/pesquisa-empregos.asp?chaves=${latin1Query(term)}&cidade=&categoria=0&zona=0&tipo=0&page=${page}`,
        );
        const found = this.parseList(html);
        for (const item of found) if (!known.has(item.id)) items.set(item.id, { ...item, categoryId: 0 });
        if (found.length < 15) break;
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    return this.withDescriptions(items, area);
  }

  private async withDescriptions(
    items: Map<string, Item & { categoryId: number }>,
    defaultArea?: Area | null,
  ) {
    const jobs: NewJob[] = [];
    for (const item of items.values()) {
      const description = await this.description(item.url).catch(() => '');
      const area = areaFromNetEmpregosCategory(item.categoryId) ?? defaultArea ?? null;
      jobs.push(this.toJob(item, description, area));
      await new Promise((r) => setTimeout(r, 300));
    }
    return jobs;
  }

  private async get(url: string) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (radar-app)' } });
    if (!res.ok) throw new Error(`Net-Empregos respondeu ${res.status}.`);
    const html = new TextDecoder('latin1').decode(await res.arrayBuffer());
    if (/<title>[^<]*Login de Candidato/i.test(html)) throw new Error('pediu login (o site está a bloquear pedidos automáticos).');
    return html;
  }

  private parseList(html: string): Item[] {
    const items: Item[] = [];
    for (const block of html.split('class="job-item').slice(1)) {
      const link = block.match(/href=\/(\d+)\/([^/\s>]+)\/>([^<]+)<\/a><\/h2>/);
      if (!link) continue;
      const li = [...block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => htmlToText(m[1]));
      items.push({
        id: link[1],
        url: `${BASE}/${link[1]}/${link[2]}/`,
        title: htmlToText(link[3]),
        date: li[0] ?? '',
        zone: li[1] ?? '',
        company: li[3] || 'Desconhecida',
      });
    }
    return items;
  }

  private async description(url: string) {
    const html = await this.get(url);
    return htmlToText(html.match(/"description":\s*"([\s\S]*?)",\s*"title"/)?.[1]);
  }

  private toJob(i: Item, description: string, area: Area | null): NewJob {
    const [d, m, y] = i.date.split('-').map(Number);
    return {
      source: 'netempregos',
      externalId: i.id,
      area,
      title: i.title,
      company: i.company,
      location: i.zone.includes('Todas') ? null : i.zone || null,
      workModel: this.workModel(i.title),
      description: description || i.title,
      url: i.url,
      publishedAt: y ? new Date(Date.UTC(y, m - 1, d)) : null,
      salaryMin: null,
      salaryMax: null,
    };
  }

  private workModel(title: string): NewJob['workModel'] {
    if (/h[ií]brid|hybrid/i.test(title)) return 'hybrid';
    if (/remot/i.test(title)) return 'remote';
    return null;
  }
}
