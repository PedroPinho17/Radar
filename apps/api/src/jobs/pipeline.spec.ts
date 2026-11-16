import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DEFAULT_PREFERENCES } from '../profile/preferences.service.js';
import { fakeConfig, fakeRepo } from '../testing/fakes.js';
import { ApplicationsService } from './applications.service.js';
import { DigestService } from './digest.service.js';
import { JobsService } from './jobs.service.js';
import { ScoringService } from './scoring.service.js';

const lock = vi.hoisted(() => ({ free: true, keys: [] as string[] }));
vi.mock('../common/db-lock.js', () => ({
  withLock: async (_db: unknown, key: string, fn: () => Promise<unknown>) => {
    lock.keys.push(key);
    return lock.free ? { ran: true, value: await fn() } : { ran: false };
  },
}));

beforeEach(() => {
  lock.free = true;
  lock.keys = [];
});

const prefs = (p: object = {}) => ({ ...DEFAULT_PREFERENCES, ...p });

// ------------------------------------------------------------------ JobsService

function jobsSetup(all: object[] = []) {
  const repo = fakeRepo();
  const execute = vi.fn().mockResolvedValue({});
  const qb = { insert: () => qb, values: vi.fn(() => qb), orUpdate: () => qb, execute };
  Object.assign(repo, { createQueryBuilder: () => qb });
  const src = (n: number, source = 's') => vi.fn().mockResolvedValue(Array.from({ length: n }, (_, i) => ({ source, externalId: String(i), area: null })));
  const sources = {
    itjobs: { fetchLatest: src(2, 'itjobs') },
    landing: { fetchLatest: vi.fn().mockRejectedValue(new Error('Landing em baixo')) },
    netEmpregos: {
      fetchLatest: src(1, 'netempregos'),
      fetchByCategories: src(1, 'netempregos'),
      fetchPairs: src(1, 'netempregos'),
      search: src(3, 'netempregos'),
    },
    wwr: { fetchLatest: src(1, 'wwr') },
    jooble: { enabled: true, search: src(4, 'jooble') },
  };
  const preferences = { all: vi.fn().mockResolvedValue(all), get: vi.fn().mockResolvedValue(prefs({ areas: ['Informática'] })) };
  const monitor = { source: vi.fn(), syncFinished: vi.fn() };
  const service = new JobsService(
    {} as never, repo as never, sources.itjobs as never, sources.landing as never, sources.netEmpregos as never,
    sources.wwr as never, preferences as never, sources.jooble as never, monitor as never,
  );
  return { service, repo, sources, preferences, monitor, qb };
}

describe('JobsService', () => {
  it('com gente de IT e de outras áreas: fontes de IT + categorias NE + pesquisa + Jooble', async () => {
    const { service, sources, monitor, qb, repo } = jobsSetup([
      prefs({ areas: ['Informática'], roles: ['Java'] }),
      prefs({ areas: ['Educação/Creche'], roles: ['Auxiliar de Ação Educativa', 'auxiliar de acao educativa'] }),
      prefs({ areas: ['Educação/Creche'], roles: ['Auxiliar de Ação Educativa', 'Ama'] }),
    ]);
    repo.count.mockResolvedValueOnce(10).mockResolvedValueOnce(15);
    const r = await service.sync();

    expect(r).toMatchObject({ inserted: 5, perSource: { itjobs: 2, landing: 'erro: Landing em baixo', jooble: 4 } });
    expect(sources.netEmpregos.fetchPairs).toHaveBeenCalled();
    expect(sources.netEmpregos.search.mock.calls[0]![0]).toEqual(['Auxiliar de Ação Educativa', 'Ama']);
    expect(sources.jooble.search.mock.calls[0]![0]).toEqual(expect.arrayContaining(['Java', 'Auxiliar de Ação Educativa', 'Ama']));
    expect(monitor.source).toHaveBeenCalledWith('landing', { error: 'Landing em baixo' });
    expect(monitor.syncFinished).toHaveBeenCalled();
    expect((qb.values.mock.calls[0] as unknown[][])[0]).toHaveLength(2 + 3 + 1 + 4);
  });

  it('só gente de outras áreas: não vai às fontes de IT', async () => {
    const { service, sources } = jobsSetup([prefs({ areas: ['Restauração/Hotelaria'], roles: ['Cozinheiro'], city: 'Albufeira' })]);
    await service.sync();
    expect(sources.itjobs.fetchLatest).not.toHaveBeenCalled();
    // restauração (42) e hotelaria (9) na zona de Faro (17), onde fica Albufeira
    expect(sources.netEmpregos.fetchPairs.mock.calls[0]![0]).toEqual([{ categoryId: 42, zoneId: 17 }, { categoryId: 9, zoneId: 17 }]);
    expect(sources.jooble.search).toHaveBeenCalledWith(expect.arrayContaining(['Cozinheiro']), 'Albufeira');
    expect(sources.netEmpregos.fetchPairs).toHaveBeenCalled();
    expect(sources.netEmpregos.search).toHaveBeenCalled();
  });

  it('sem utilizadores: fontes de IT (o Radar começou assim)', async () => {
    const { service, sources } = jobsSetup([]);
    await service.sync();
    expect(sources.itjobs.fetchLatest).toHaveBeenCalled();
    expect(sources.netEmpregos.fetchPairs).toHaveBeenCalled();
    expect(sources.jooble.search).not.toHaveBeenCalled();
  });

  it('outra instância a sincronizar: salta', async () => {
    const { service, sources } = jobsSetup([]);
    lock.free = false;
    await expect(service.sync()).resolves.toMatchObject({ skipped: true, inserted: 0 });
    expect(sources.itjobs.fetchLatest).not.toHaveBeenCalled();
  });

  it('dois pedidos ao mesmo tempo = um só sync; syncIfStale respeita a idade', async () => {
    const { service, sources } = jobsSetup([]);
    await Promise.all([service.sync(), service.sync()]);
    expect(sources.itjobs.fetchLatest).toHaveBeenCalledTimes(1);
    await service.syncIfStale(60_000); // acabou de sincronizar
    expect(sources.itjobs.fetchLatest).toHaveBeenCalledTimes(1);
    await service.syncIfStale(-1);
    expect(sources.itjobs.fetchLatest).toHaveBeenCalledTimes(2);
  });

  it('dailySync nunca rebenta; list e filtered', async () => {
    const { service, repo, preferences } = jobsSetup([]);
    preferences.all.mockRejectedValue(new Error('BD'));
    await expect(service.dailySync()).resolves.toBeUndefined();
    service.onApplicationBootstrap();

    repo.find.mockResolvedValue([{ title: 'Java Developer', location: 'Porto', workModel: null }, { title: 'Cozinheiro', location: 'Porto', workModel: null }]);
    await expect(service.filtered('u1')).resolves.toMatchObject({ total: 2, kept: 1 });
    await service.list();
    expect(repo.find).toHaveBeenLastCalledWith({ order: { publishedAt: 'DESC' }, take: 50 });
  });
});

// ------------------------------------------------------------------ ApplicationsService

describe('ApplicationsService', () => {
  const setup = () => {
    const apps = fakeRepo();
    const events = fakeRepo();
    const jobs = fakeRepo();
    const matches = fakeRepo();
    return { apps, events, jobs, matches, service: new ApplicationsService(apps as never, events as never, jobs as never, matches as never) };
  };
  const JOB = '6f9619ff-8b86-4d11-b42d-00c04fc964ff';

  it('regista a candidatura e marca o match como "applied"', async () => {
    const { service, jobs, matches, apps } = setup();
    jobs.existsBy.mockResolvedValue(true);
    await service.apply('u1', { jobId: JOB, note: ' enviado por email ' });
    expect(apps.create.mock.calls[0]![0]).toMatchObject({ userId: 'u1', jobId: JOB, status: 'applied', events: [{ note: 'enviado por email' }] });
    expect(matches.update).toHaveBeenCalledWith({ userId: 'u1', jobId: JOB }, expect.objectContaining({ decision: 'applied' }));
  });

  it('erros: jobId inválido, oferta inexistente, candidatura repetida', async () => {
    const { service, jobs, apps } = setup();
    await expect(service.apply('u1', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.apply('u1', { jobId: JOB })).rejects.toBeInstanceOf(NotFoundException);
    jobs.existsBy.mockResolvedValue(true);
    apps.existsBy.mockResolvedValue(true);
    await expect(service.apply('u1', { jobId: JOB })).rejects.toBeInstanceOf(ConflictException);
  });

  it('atualiza o estado só nas candidaturas da própria pessoa', async () => {
    const { service, apps, events } = setup();
    await expect(service.updateStatus('u1', 'a1', { status: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateStatus('u1', 'a1', { status: 'interview' })).rejects.toBeInstanceOf(NotFoundException);
    apps.findOneBy.mockResolvedValue({ id: 'a1', status: 'applied' });
    apps.findOne.mockResolvedValue({ id: 'a1', status: 'interview' });
    await expect(service.updateStatus('u1', 'a1', { status: 'interview', note: 'dia 20' })).resolves.toMatchObject({ status: 'interview' });
    expect(events.create.mock.calls[0]![0]).toMatchObject({ status: 'interview', note: 'dia 20' });
  });

  it('marca como "parada" ao fim de 14 dias sem novidades (só as em curso)', async () => {
    const { service, apps } = setup();
    const old = new Date(Date.now() - 20 * 86_400_000);
    apps.find.mockResolvedValue([
      { status: 'applied', updatedAt: old }, { status: 'rejected', updatedAt: old }, { status: 'interview', updatedAt: new Date() },
    ]);
    expect((await service.list('u1')).map((a) => a.stale)).toEqual([true, false, false]);
  });
});

// ------------------------------------------------------------------ DigestService

function digestSetup() {
  const users = fakeRepo();
  const preferences = {
    get: vi.fn().mockResolvedValue(prefs({ emailDays: [0, 1, 2, 3, 4, 5, 6], emailTimes: ['08:30'], digestMinScore: 60, emailMaxJobs: 1 })),
    lastDigestAt: vi.fn().mockResolvedValue(null),
    markDigestSent: vi.fn(),
  };
  const now = Date.now();
  const m = (score: number, ageMs = 0, decision: string | null = null) => ({
    score, decision, createdAt: new Date(now - ageMs), reasons: ['r'],
    job: { title: `T${score}`, company: 'C', location: 'Porto', workModel: 'remote', salaryMin: 20000, salaryMax: 25000, url: `https://x/${score}` },
  });
  const match = {
    matchPending: vi.fn().mockResolvedValue({ pending: 0, scored: 0 }),
    list: vi.fn().mockResolvedValue([m(90), m(70), m(40), m(80, 0, 'like'), m(95, 3 * 86_400_000)]),
  };
  const applications = {
    list: vi.fn().mockResolvedValue([{ stale: true, status: 'applied', updatedAt: new Date(now - 20 * 86_400_000), job: { title: 'Velha', company: 'X', url: 'https://x/v' } }]),
  };
  const jobs = { syncIfStale: vi.fn().mockResolvedValue(undefined) };
  const monitor = { digestRun: vi.fn() };
  const mail = { send: vi.fn().mockResolvedValue(undefined) };
  const service = new DigestService(
    {} as never, users as never, preferences as never, match as never, applications as never, jobs as never,
    monitor as never, mail as never, fakeConfig({ WEB_URL: 'https://radar.test/' }),
  );
  return { service, users, preferences, match, applications, jobs, monitor, mail };
}

describe('DigestService.sendFor', () => {
  it('envia as melhores ofertas novas (limite por email), follow-ups, texto e List-Unsubscribe', async () => {
    const { service, mail, preferences } = digestSetup();
    const r = await service.sendFor({ id: 'u1', email: 'x@y.pt' });
    expect(r).toEqual({ sent: true, matches: 1, stale: 1 });
    const [to, subject, rawHtml, opts] = mail.send.mock.calls[0]!;
    // o React separa pedaços de texto com comentários; o pt-PT usa espaços finos nos milhares
    const html = (rawHtml as string).replace(/<!-- -->/g, '').replace(/[\u202f\u00a0]/g, ' ');
    expect(to).toBe('x@y.pt');
    expect(subject).toBe('Radar: 1 oferta nova, 1 follow-up');
    expect(html).toContain('T90');
    expect(html).not.toContain('T40'); // abaixo da nota mínima
    expect(html).toContain('E mais 1 oferta'); // a de 70 ficou de fora do limite
    expect(html).toContain('20 000 – 25 000 €');
    expect(opts.text).toContain('T90');
    expect(opts.headers['List-Unsubscribe']).toBe('<https://radar.test/perfil#emails>');
    expect(preferences.markDigestSent).toHaveBeenCalled();
  });

  it('manual (teste): últimas 24h, não mexe no agendamento', async () => {
    const { service, preferences } = digestSetup();
    await service.sendFor({ id: 'u1', email: 'x@y.pt' }, { manual: true });
    expect(preferences.lastDigestAt).not.toHaveBeenCalled();
    expect(preferences.markDigestSent).not.toHaveBeenCalled();
  });

  it('sem novidades não envia; follow-ups só no primeiro email do dia', async () => {
    const { service, preferences, match, mail } = digestSetup();
    preferences.lastDigestAt.mockResolvedValue(new Date()); // já recebeu hoje
    match.list.mockResolvedValue([]);
    await expect(service.sendFor({ id: 'u1', email: 'x@y.pt' })).resolves.toEqual({ sent: false, matches: 0, stale: 0 });
    expect(mail.send).not.toHaveBeenCalled();
  });
});

describe('DigestService.tick', () => {
  it('envia só a quem tem email confirmado e marcou este dia/hora', async () => {
    const { service, users, preferences, monitor, match } = digestSetup();
    users.find.mockResolvedValue([
      { id: 'a', email: 'a@x.pt', emailVerifiedAt: new Date() },
      { id: 'b', email: 'b@x.pt', emailVerifiedAt: null },
      { id: 'c', email: 'c@x.pt', emailVerifiedAt: new Date() },
      { id: 'd', email: 'd@x.pt', emailVerifiedAt: new Date() },
    ]);
    // a hora "de agora" em Lisboa, arredondada à meia hora, para todos os dias
    const { lisbonSlot } = await import('./digest.service.js');
    const slot = lisbonSlot();
    preferences.get.mockImplementation(async (id: string) => prefs({
      emailDays: [0, 1, 2, 3, 4, 5, 6], emailTimes: [id === 'c' ? '03:00' : slot.time], dailyEmail: true, digestMinScore: 0, emailMaxJobs: 5,
    }));
    match.matchPending
      .mockResolvedValueOnce({ pending: 1, scored: 1 }) // a
      .mockRejectedValueOnce(new Error('rebentou')); // d

    await service.tick();
    expect(lock.keys[0]).toBe(`radar:digest:${slot.day}:${slot.time}`);
    expect(match.matchPending.mock.calls.map((c) => c[0])).toEqual(['a', 'd']);
    expect(monitor.digestRun).toHaveBeenCalledWith(expect.objectContaining({ sent: 1, failed: 1, errors: ['rebentou'] }));
  });

  it('sem CV ou com análise a decorrer: envia com o que já há; sem ninguém: não faz nada', async () => {
    const { service, users, preferences, match, monitor, jobs } = digestSetup();
    const { lisbonSlot } = await import('./digest.service.js');
    preferences.get.mockResolvedValue(prefs({ emailDays: [0, 1, 2, 3, 4, 5, 6], emailTimes: [lisbonSlot().time] }));
    users.find.mockResolvedValue([{ id: 'a', email: 'a@x.pt', emailVerifiedAt: new Date() }, { id: 'b', email: 'b', emailVerifiedAt: new Date() }]);
    match.matchPending.mockRejectedValueOnce(new NotFoundException()).mockRejectedValueOnce(new ConflictException());
    jobs.syncIfStale.mockRejectedValue(new Error('sync falhou'));
    await service.tick();
    expect(monitor.digestRun).toHaveBeenCalledWith(expect.objectContaining({ failed: 0 }));

    users.find.mockResolvedValue([]);
    monitor.digestRun.mockClear();
    await service.tick();
    expect(monitor.digestRun).not.toHaveBeenCalled();
  });

  it('outra instância já está a enviar este lote: não envia', async () => {
    const { service, users, preferences, mail } = digestSetup();
    const { lisbonSlot } = await import('./digest.service.js');
    preferences.get.mockResolvedValue(prefs({ emailDays: [0, 1, 2, 3, 4, 5, 6], emailTimes: [lisbonSlot().time] }));
    users.find.mockResolvedValue([{ id: 'a', email: 'a@x.pt', emailVerifiedAt: new Date() }]);
    lock.free = false;
    await service.tick();
    expect(mail.send).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------ ScoringService

describe('ScoringService', () => {
  it('avalia um pouco para cada pessoa ativa; ignora sem CV / ocupadas', async () => {
    const db = { query: vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]) };
    const jobs = { syncIfStale: vi.fn().mockRejectedValue(new Error('sync')) };
    const match = {
      matchPending: vi.fn()
        .mockResolvedValueOnce({ scored: 3 })
        .mockRejectedValueOnce(new NotFoundException())
        .mockRejectedValueOnce(new ConflictException())
        .mockRejectedValueOnce(new Error('IA')),
    };
    const service = new ScoringService(db as never, jobs as never, match as never);
    await service.backgroundRound();
    expect(lock.keys).toContain('radar:scoring');
    // só confirmados E (emails ligados OU sessão ativa)
    const query = db.query.mock.calls[0]![0] as string;
    expect(query).toContain('"emailVerifiedAt" IS NOT NULL');
    expect(query).toContain('"dailyEmail"');
    expect(query).toContain('FROM sessions');
    expect(match.matchPending).toHaveBeenCalledWith('a', 15);
    await expect(service.round()).resolves.toMatchObject({ people: 4 });

    lock.free = false;
    match.matchPending.mockClear();
    await service.backgroundRound();
    expect(match.matchPending).not.toHaveBeenCalled();
  });
});
