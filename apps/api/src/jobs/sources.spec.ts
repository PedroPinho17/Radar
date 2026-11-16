import { fakeConfig } from '../testing/fakes.js';
import { htmlToText } from './html.js';
import { ItjobsService } from './itjobs.service.js';
import { JoobleService } from './jooble.service.js';
import { LandingService } from './landing.service.js';
import { NetEmpregosService } from './netempregos.service.js';
import { WwrService } from './wwr.service.js';

const latin1 = (s: string) => new Response(Buffer.from(s, 'latin1'));
afterEach(() => vi.unstubAllGlobals());

it('htmlToText limpa tags e entidades', () => {
  expect(htmlToText('<p>Olá&nbsp;<b>mundo</b></p><li>a &amp; b &lt;3&gt; &quot;x&quot; &#39;y&#39;</li>')).toBe('Olá mundo a & b <3> "x" \'y\'');
  expect(htmlToText(null)).toBe('');
});

describe('ItjobsService', () => {
  it('pagina e converte as ofertas', async () => {
    const one = (id: number) => ({
      id, title: `Dev ${id}`, body: '<p>Java</p>', slug: 'dev', workModel: 2, publishedAt: '2026-11-12 14:24:19',
      company: { name: 'ACME' }, locations: [{ name: 'Porto' }, { name: 'Braga' }], salaryMin: 20000, salaryMax: null,
    });
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ results: Array.from({ length: 100 }, (_, i) => one(i)) }))
      .mockResolvedValueOnce(Response.json({ results: [{ ...one(500), workModel: null, locations: undefined, salaryMin: undefined }] }));
    vi.stubGlobal('fetch', fetch);
    const jobs = await new ItjobsService(fakeConfig({ ITJOBS_API_KEY: 'k' })).fetchLatest();
    expect(jobs).toHaveLength(101);
    expect(jobs[0]).toMatchObject({
      source: 'itjobs', externalId: '0', location: 'Porto, Braga', workModel: 'hybrid', description: 'Java',
      url: 'https://www.itjobs.pt/oferta/0/dev', salaryMin: 20000,
    });
    expect(jobs[100]).toMatchObject({ location: null, workModel: null, salaryMin: null });
  });

  it('erro HTTP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    await expect(new ItjobsService(fakeConfig({ ITJOBS_API_KEY: 'k' })).fetchLatest()).rejects.toThrow('500');
  });
});

describe('LandingService', () => {
  it('só ofertas em Portugal ou remotas; salário só em euros', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([
      { id: 1, title: 'A', url: 'https://landing.jobs/at/in-scale/a', remote: false, role_description: '<p>x</p>', main_requirements: null, nice_to_have: null, published_at: '2026-11-10', currency_code: 'EUR', gross_salary_low: 30000, gross_salary_high: 40000, locations: [{ city: 'Lisboa', country_code: 'PT' }] },
      { id: 2, title: 'B', url: 'https://landing.jobs/at/b/b', remote: true, role_description: null, main_requirements: null, nice_to_have: null, published_at: '2026-11-10', currency_code: 'USD', gross_salary_low: 1, gross_salary_high: 2 },
      { id: 3, title: 'C', url: 'x', remote: false, published_at: '2026-11-10', locations: [{ city: 'Madrid', country_code: 'ES' }] },
    ])));
    const jobs = await new LandingService().fetchLatest();
    expect(jobs.map((j) => j.externalId)).toEqual(['1', '2']);
    expect(jobs[0]).toMatchObject({ company: 'In Scale', location: 'Lisboa', salaryMin: 30000, workModel: null });
    expect(jobs[1]).toMatchObject({ workModel: 'remote', salaryMin: null, location: null });
  });

  it('erro HTTP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(new LandingService().fetchLatest()).rejects.toThrow('503');
  });
});

describe('WwrService', () => {
  const item = (id: string, region: string) => `<item><title><![CDATA[ACME: Backend ${id}]]></title><region>${region}</region>
    <link>https://weworkremotely.com/remote-jobs/${id}</link><pubDate>Tue, 10 Nov 2026 10:00:00 +0000</pubDate>
    <description>&lt;p&gt;Node&lt;/p&gt;</description></item>`;

  it('lê o RSS, junta categorias e filtra regiões', async () => {
    // 2 categorias = 2 pedidos (um Response novo de cada vez); a oferta "a" aparece nas duas
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`<rss>${item('a', 'Anywhere in the World')}${item('b', 'USA Only')}${item('c', 'Asia')}</rss>`)));
    const jobs = await new WwrService().fetchLatest();
    expect(jobs.map((j) => j.externalId)).toEqual(['a', 'b']);
    expect(jobs[0]).toMatchObject({ company: 'ACME', title: 'Backend a', description: 'Node', workModel: 'remote' });
  });

  it('erro HTTP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(new WwrService().fetchLatest()).rejects.toThrow('404');
  });
});

describe('NetEmpregosService', () => {
  const list = (ids: string[]) => `<html>${ids.map((id) => `<div class="job-item">
    <h2><a href=/${id}/auxiliar-${id}/>Auxiliar de Ação Educativa ${id} (Híbrido)</a></h2>
    <li>13-11-2026</li><li>Porto</li><li>Educação</li><li>Colégio ${id}</li></div>`).join('')}</html>`;
  const page = '<script>{"description": "Cuidar de crian&ccedil;as", "title": "x"}</script>';

  it('pesquisa por palavras (em ISO-8859-1) e lê a descrição', async () => {
    const fetch = vi.fn(async (url: string) => (url.includes('pesquisa') ? latin1(list(['1', '2'])) : latin1(page)));
    vi.stubGlobal('fetch', fetch);
    const jobs = await new NetEmpregosService().search(['ação educativa'], new Set(['2']), 1);
    expect(fetch.mock.calls[0]![0]).toContain('chaves=a%E7%E3o+educativa');
    expect(jobs).toHaveLength(1); // o 2 já existia
    expect(jobs[0]).toMatchObject({
      externalId: '1', title: 'Auxiliar de Ação Educativa 1 (Híbrido)', company: 'Colégio 1', location: 'Porto',
      workModel: 'hybrid', publishedAt: new Date(Date.UTC(2026, 10, 13)),
    });
  });

  it('listagem de Informática; descrição em falta usa o título; "Todas" = sem local', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      url.includes('pesquisa') ? latin1(list(['9']).replace('<li>Porto</li>', '<li>Todas as zonas</li>').replace('(Híbrido)', 'Remoto')) : latin1('<html></html>')));
    const jobs = await new NetEmpregosService().fetchLatest(new Set(), 1);
    expect(jobs[0]).toMatchObject({ location: null, workModel: 'remote', description: jobs[0]!.title });
  });

  it('página vazia, bloqueio e erro HTTP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(latin1('<html></html>')));
    await expect(new NetEmpregosService().fetchLatest(new Set(), 1)).rejects.toThrow('não devolveu ofertas');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(latin1('<title>Net-Empregos - Login de Candidato</title>')));
    await expect(new NetEmpregosService().search(['x'])).rejects.toThrow('pediu login');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    await expect(new NetEmpregosService().search(['x'])).rejects.toThrow('500');
  });
});

describe('JoobleService', () => {
  it('desligado sem chave', async () => {
    const s = new JoobleService(fakeConfig());
    expect(s.enabled).toBe(false);
    await expect(s.search(['x'])).resolves.toEqual([]);
  });

  it('pesquisa cada termo e converte', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ jobs: [
      { id: 7, title: '<b>Cozinheiro</b> (remoto)', location: 'Porto', snippet: 'Cozinha', link: 'https://j/7', company: 'Rest', updated: '2026-11-10T00:00:00' },
      { id: 8, title: 'Sem link', link: '' },
      { id: 9, title: 'Ajudante', link: 'https://j/9', type: 'Híbrido', updated: 'lixo' },
    ] }));
    vi.stubGlobal('fetch', fetch);
    const jobs = await new JoobleService(fakeConfig({ JOOBLE_API_KEY: 'KEY', JOOBLE_API_URL: 'https://api.test/x' })).search(['cozinheiro']);
    expect(fetch.mock.calls[0]![0]).toBe('https://api.test/x/KEY');
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({ keywords: 'cozinheiro', location: 'Portugal' });
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({ source: 'jooble', title: 'Cozinheiro (remoto)', workModel: 'remote', company: 'Rest' });
    expect(jobs[1]).toMatchObject({ workModel: 'hybrid', company: 'Desconhecida', publishedAt: null, description: 'Ajudante' });
  });

  it('erro HTTP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));
    await expect(new JoobleService(fakeConfig({ JOOBLE_API_KEY: 'k' })).search(['x'])).rejects.toThrow('403');
  });
});
