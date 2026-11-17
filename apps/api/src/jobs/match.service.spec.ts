import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { fakeConfig, fakeRepo } from '../testing/fakes.js';
import { DEFAULT_PREFERENCES } from '../profile/preferences.service.js';
import { interleaveBySource, MatchService } from './match.service.js';

const ai = vi.hoisted(() => ({
  gemini: vi.fn(),
  groq: vi.fn(),
  lockFree: true,
}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class { models = { generateContent: ai.gemini }; },
}));
vi.mock('groq-sdk', () => ({
  default: class { chat = { completions: { create: ai.groq } }; },
}));
vi.mock('../common/db-lock.js', () => ({
  withLock: async (_db: unknown, _key: string, fn: () => Promise<unknown>) =>
    ai.lockFree ? { ran: true, value: await fn() } : { ran: false },
}));

const good = { score: 80, reasons: ['Bate certo'], missingSkills: [], englishRequired: false, minYears: 2 };
const geminiSays = (o: unknown) => ({ text: typeof o === 'string' ? o : JSON.stringify(o) });
const groqSays = (o: unknown) => ({ choices: [{ message: { content: JSON.stringify(o) } }] });

const job = (id: string, title = 'Java Developer', source = 'itjobs') => ({
  id, source, title, company: 'ACME', location: 'Porto', workModel: 'hybrid', description: 'Spring Boot', salaryMin: 20000, salaryMax: null,
});
const profile = {
  userId: 'u1', user: {}, title: 'Dev', yearsExperience: 2, seniority: 'junior', skills: ['Java'], languages: ['Portuguese'],
  location: 'Porto', summary: 'x', sector: 'Informática', suggestedRoles: [], updatedAt: new Date(),
  education: null, drivingLicense: null, source: 'cv' as const,
};

function setup() {
  const jobs = fakeRepo();
  const matches = fakeRepo();
  const profiles = { get: vi.fn().mockResolvedValue(profile) };
  const preferences = { get: vi.fn().mockResolvedValue({ ...DEFAULT_PREFERENCES, areas: ['Informática'], sector: 'Informática', maxYears: 3 }) };
  const monitor = { aiRun: vi.fn() };
  const salary = { enabled: true, estimate: vi.fn().mockResolvedValue(null) };
  const service = new MatchService(
    {} as never, jobs as never, matches as never, profiles as never, preferences as never, monitor as never,
    salary as never,
    fakeConfig({
      GEMINI_API_KEY: 'k', GROQ_API_KEY: 'k', GEMINI_MODEL: 'g-main', GROQ_MODEL: 'groq', GEMINI_FALLBACK_MODEL: 'g-fallback',
      AI_DELAY_MS: '0', AI_RETRY_MS: '0',
    }),
  );
  return { service, jobs, matches, profiles, preferences, monitor, salary };
}

beforeEach(() => {
  ai.gemini.mockReset();
  ai.groq.mockReset();
  ai.lockFree = true;
});

describe('interleaveBySource', () => {
  it('alterna uma oferta de cada fonte e respeita o limite', () => {
    const jobs = [
      job('ne1', 'A', 'netempregos'),
      job('ne2', 'B', 'netempregos'),
      job('ne3', 'C', 'netempregos'),
      job('it1', 'D', 'itjobs'),
      job('it2', 'E', 'itjobs'),
      job('ww1', 'F', 'wwr'),
    ];
    expect(interleaveBySource(jobs, 4).map((j) => j.id)).toEqual(['ne1', 'it1', 'ww1', 'ne2']);
  });
});

describe('MatchService.matchPending', () => {
  it('avalia só as ofertas que passam nos filtros e ainda não têm nota', async () => {
    const { service, jobs, matches, monitor } = setup();
    jobs.find.mockResolvedValue([job('j1'), job('j2'), job('j3', 'Ajudante de Cozinha')]);
    matches.find.mockResolvedValueOnce([]).mockResolvedValueOnce([{ jobId: 'j2' }]); // history, depois "já avaliadas"
    ai.gemini.mockResolvedValue(geminiSays(good));

    await expect(service.matchPending('u1')).resolves.toEqual({ pending: 1, scored: 1 });
    expect(matches.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', jobId: 'j1', score: 80 }));
    expect(monitor.aiRun).toHaveBeenCalledWith(1, 1, undefined);
    const prompt = ai.gemini.mock.calls[0]![0].contents as string;
    expect(prompt).toContain('20000-? EUR gross/year');
    expect(prompt).toContain('"areas":["Informática"]');
  });

  it('quando a IA principal falha, usa a seguinte; se todas falham, regista o erro', async () => {
    const { service, jobs, matches, monitor } = setup();
    jobs.find.mockResolvedValue([job('j1'), job('j2')]);
    matches.find.mockResolvedValue([]);
    ai.gemini.mockRejectedValueOnce(new Error('503 UNAVAILABLE')).mockRejectedValueOnce(new Error('503 UNAVAILABLE'));
    ai.groq.mockResolvedValueOnce(groqSays(good));
    ai.gemini.mockResolvedValueOnce(geminiSays('não é json')); // 2.ª oferta: gemini lixo…
    ai.groq.mockRejectedValueOnce(new Error('quota'));            // …groq falha…
    ai.gemini.mockRejectedValueOnce(new Error('fallback em baixo')); // …e o fallback também

    await expect(service.matchPending('u1')).resolves.toEqual({ pending: 2, scored: 1 });
    expect(monitor.aiRun).toHaveBeenCalledWith(2, 1, 'fallback em baixo');
  });

  it('rejeita texto com acentos corrompidos ("??") e pede a outro modelo', async () => {
    const { service, jobs, matches } = setup();
    jobs.find.mockResolvedValue([job('j1')]);
    matches.find.mockResolvedValue([]);
    ai.gemini.mockResolvedValueOnce(geminiSays({ ...good, reasons: ['??rea errada'] }));
    ai.groq.mockResolvedValueOnce(groqSays({ ...good, reasons: ['Área certa'] }));
    await service.matchPending('u1');
    expect(matches.save.mock.calls[0]![0].reasons).toEqual(['Área certa']);
  });

  it('uma análise de cada vez por pessoa (409 se já houver outra a correr)', async () => {
    const { service } = setup();
    ai.lockFree = false;
    await expect(service.matchPending('u1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('alterna entre fontes em vez de ir só pelas mais recentes', async () => {
    const { service, jobs, matches } = setup();
    jobs.find.mockResolvedValue([
      job('ne1', 'Java Developer', 'netempregos'),
      job('ne2', 'Java Developer', 'netempregos'),
      job('ne3', 'Java Developer', 'netempregos'),
      job('it1', 'Java Developer', 'itjobs'),
      job('ww1', 'Java Developer', 'wwr'),
    ]);
    matches.find.mockResolvedValue([]);
    ai.gemini.mockResolvedValue(geminiSays(good));

    await expect(service.matchPending('u1', 3)).resolves.toEqual({ pending: 3, scored: 3 });
    const scoredIds = matches.save.mock.calls.map((c) => c[0].jobId);
    expect(scoredIds).toEqual(['ne1', 'it1', 'ww1']);
  });
});

describe('MatchService · lista e decisões', () => {
  it('esconde ofertas que pedem mais anos do que o máximo', async () => {
    const { service, matches } = setup();
    matches.find.mockResolvedValue([{ minYears: null }, { minYears: 2 }, { minYears: 5 }]);
    await expect(service.list('u1')).resolves.toHaveLength(2);
  });

  it('o email (list) nunca pede estimativas de salário; o site (listWithSalaries) sim', async () => {
    const { service, matches, salary } = setup();
    const m = (salaryMin: number | null) => ({
      minYears: null,
      job: { title: 'Dev', salaryMin, salaryMax: null, location: 'Remoto (USA)' },
    });
    matches.find.mockResolvedValue([m(null), m(30000)]);
    salary.estimate.mockResolvedValue(28000);

    await service.list('u1');
    expect(salary.estimate).not.toHaveBeenCalled();

    const shown = await service.listWithSalaries('u1');
    expect(shown.map((x) => (x as { estimatedSalary?: number | null }).estimatedSalary)).toEqual([28000, null]);
    expect(salary.estimate).toHaveBeenCalledTimes(1); // só a que não diz o salário
    expect(salary.estimate).toHaveBeenCalledWith('Dev', 2, ['Java'], 'Remoto (USA)'); // envia a localização
  });

  it('sem estimativas: serviço desligado, área que não é IT ou sem perfil', async () => {
    const { service, matches, salary, preferences, profiles } = setup();
    matches.find.mockResolvedValue([{ minYears: null, job: { title: 'Dev', salaryMin: null, salaryMax: null } }]);
    salary.enabled = false;
    await service.listWithSalaries('u1');
    salary.enabled = true;
    preferences.get.mockResolvedValue({ ...DEFAULT_PREFERENCES, areas: ['Limpeza'], maxYears: 3 });
    await service.listWithSalaries('u1');
    preferences.get.mockResolvedValue({ ...DEFAULT_PREFERENCES, areas: ['Informática'], maxYears: 3 });
    profiles.get.mockRejectedValue(new Error('sem perfil'));
    await service.listWithSalaries('u1');
    expect(salary.estimate).not.toHaveBeenCalled();
  });

  it('guarda a decisão só em matches da própria pessoa', async () => {
    const { service, matches } = setup();
    await expect(service.decide('u1', 'm1', { decision: 'talvez' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.decide('u1', 'm1', { decision: 'like' })).rejects.toBeInstanceOf(NotFoundException);
    matches.findOneBy.mockResolvedValue({ id: 'm1' });
    const saved = await service.decide('u1', 'm1', { decision: 'dislike', reason: ' longe ' });
    expect(saved).toMatchObject({ decision: 'dislike', decisionReason: 'longe' });
    expect(matches.findOneBy).toHaveBeenCalledWith({ id: 'm1', userId: 'u1' });
  });
});

describe('MatchService.coverLetter', () => {
  const letter = (text: string) => ({ language: 'pt', letter: text.padEnd(250, '.') });

  it('escreve a carta, recusa frases proibidas e pede outra', async () => {
    const { service, matches, preferences } = setup();
    preferences.get.mockResolvedValue({ ...DEFAULT_PREFERENCES, githubUsername: 'pedro', notes: 'nota' });
    matches.findOne.mockResolvedValue({ id: 'm1', job: job('j1') });
    ai.gemini
      .mockResolvedValueOnce(geminiSays(letter('Sou fluente em inglês')))
      .mockResolvedValueOnce(geminiSays(letter('Tenho experiência com Java')));

    const r = await service.coverLetter('u1', 'm1', 'en');
    expect(r).toMatchObject({ matchId: 'm1', language: 'pt' });
    expect(r.letter).toContain('Tenho experiência');
    const prompt = ai.gemini.mock.calls[0]![0].contents as string;
    expect(prompt).toContain('WRITE IN: English');
    expect(prompt).not.toContain('suggestedRoles');
    expect(matches.save).toHaveBeenCalledWith(expect.objectContaining({ coverLetter: r.letter }));
  });

  it('match de outra pessoa → 404', async () => {
    const { service } = setup();
    await expect(service.coverLetter('u1', 'm1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
