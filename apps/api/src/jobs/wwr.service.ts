import { Injectable } from '@nestjs/common';
import type { NewJob } from './itjobs.service.js';
import { htmlToText } from './html.js';

const CATEGORIES = ['remote-back-end-programming-jobs', 'remote-full-stack-programming-jobs'];

/** Lê <tag>…</tag> de um <item> do RSS */
const tag = (xml: string, name: string) =>
  xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.replace(/^<!\[CDATA\[|\]\]>$/g, '').trim() ?? '';

/** Fonte We Work Remotely (RSS) — remoto tech; só para Informática. */
@Injectable()
export class WwrService {
  async fetchLatest(): Promise<NewJob[]> {
    const jobs = new Map<string, NewJob>(); // a mesma oferta pode estar em duas categorias
    for (const category of CATEGORIES) {
      const res = await fetch(`https://weworkremotely.com/categories/${category}.rss`, {
        headers: { 'User-Agent': 'radar-app' },
      });
      if (!res.ok) throw new Error(`We Work Remotely respondeu ${res.status}.`);
      const xml = await res.text();
      for (const item of xml.split('<item>').slice(1)) {
        const job = this.toJob(item);
        // só regiões onde podes trabalhar a partir de Portugal
        if (!/anywhere|europe|emea|usa|portugal/i.test(job.location ?? '')) continue;
        jobs.set(job.externalId, job);
      }
    }
    return [...jobs.values()];
  }

  private toJob(item: string): NewJob {
    const url = tag(item, 'link');
    const full = htmlToText(tag(item, 'title')); // "Empresa: Título"
    const sep = full.indexOf(': ');
    const region = tag(item, 'region') || 'Anywhere in the World';
    return {
      source: 'wwr',
      externalId: url.split('/').pop() ?? url,
      area: 'Informática',
      title: sep > 0 ? full.slice(sep + 2) : full,
      company: sep > 0 ? full.slice(0, sep) : 'Desconhecida',
      location: `Remoto (${region})`,
      workModel: 'remote',
      // a descrição vem com o HTML "escapado" (&lt;p&gt;), por isso limpa-se duas vezes
      description: htmlToText(htmlToText(tag(item, 'description'))),
      url,
      publishedAt: new Date(tag(item, 'pubDate')),
      salaryMin: null, // os salários vêm em dólares e não comparam com os teus
      salaryMax: null,
    };
  }
}