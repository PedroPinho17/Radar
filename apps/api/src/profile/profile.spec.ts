import { BadGatewayException, BadRequestException, NotFoundException } from '@nestjs/common';
import { fakeConfig, fakeRepo } from '../testing/fakes.js';
import { GithubService } from './github.service.js';
import { DEFAULT_PREFERENCES, PreferencesService } from './preferences.service.js';
import { ProfileService } from './profile.service.js';
import { IT_EXCLUDES, isTech } from './sectors.js';

const gen = vi.hoisted(() => vi.fn());
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent: gen }; } }));

afterEach(() => {
  vi.unstubAllGlobals();
  gen.mockReset();
});

describe('sectors', () => {
  it('contas antigas (sem área) contam como IT', () => {
    expect(isTech(null)).toBe(true);
    expect(isTech([], null)).toBe(true);
    expect(isTech([], 'Tecnologia')).toBe(true);
    expect(isTech(['Informática'])).toBe(true);
    expect(isTech([], 'Educação')).toBe(false);
    expect(isTech(['Educação/Creche'])).toBe(false);
  });
});

describe('PreferencesService', () => {
  const setup = () => {
    const repo = fakeRepo();
    return { repo, service: new PreferencesService(repo as never) };
  };

  it('quem nunca guardou recebe as preferências por omissão (neutras)', async () => {
    const { service } = setup();
    const p = await service.get('u1');
    expect(p).toEqual(DEFAULT_PREFERENCES);
    expect(p.excludeKeywords).toEqual([]);
    expect(p.sector).toBeNull();
  });

  it('não expõe campos internos', async () => {
    const { service, repo } = setup();
    repo.findOneBy.mockResolvedValue({ ...DEFAULT_PREFERENCES, userId: 'u1', user: {}, updatedAt: new Date(), lastDigestAt: new Date() });
    const p = await service.get('u1');
    expect(p).not.toHaveProperty('userId');
    expect(p).not.toHaveProperty('lastDigestAt');
  });

  it('valida, limpa duplicados e ordena dias/horas', async () => {
    const { service, repo } = setup();
    repo.findOneBy.mockResolvedValueOnce(null).mockImplementationOnce(async () => ({ ...repo.save.mock.calls[0]![0] }));
    const p = await service.update('u1', {
      onsiteLocations: ['Porto', 'porto', ' Maia '],
      emailDays: [0, 5, 1, 1],
      emailTimes: ['18:00', '08:30'],
      areas: ['Educação/Creche'],
    });
    expect(p.onsiteLocations).toEqual(['Porto', 'Maia']);
    expect(p.areas).toEqual(['Educação/Creche']);
    expect(p.emailDays).toEqual([1, 5, 0]);
    expect(p.emailTimes).toEqual(['08:30', '18:00']);
  });

  it.each([
    [{ emailTimes: ['08:15'] }, 'Hora inválida'],
    [{ emailTimes: [] }, 'pelo menos uma hora'],
    [{ targetSalaryMin: 40000, targetSalaryMax: 30000 }, 'não pode ser maior'],
    [{ emailDays: [] }, 'pelo menos um dia'],
    [{ areas: ['Astronauta'] }, ''],
    [{ githubUsername: 'nome inválido!' }, 'GitHub'],
  ])('recusa %o', async (body, msg) => {
    const { service } = setup();
    await expect(service.update('u1', body)).rejects.toThrow(msg ? new RegExp(msg) : BadRequestException);
  });

  it('lastDigestAt / markDigestSent / all', async () => {
    const { service, repo } = setup();
    repo.findOne.mockResolvedValueOnce({ lastDigestAt: new Date(5) }).mockResolvedValueOnce(null);
    await expect(service.lastDigestAt('u1')).resolves.toEqual(new Date(5));
    await expect(service.lastDigestAt('u1')).resolves.toBeNull();

    repo.existsBy.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await service.markDigestSent('u1', new Date(7));
    expect(repo.update).toHaveBeenCalledWith({ userId: 'u1' }, { lastDigestAt: new Date(7) });
    await service.markDigestSent('u2', new Date(8));
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u2', lastDigestAt: new Date(8) }));

    repo.find.mockResolvedValue([{ ...DEFAULT_PREFERENCES, userId: 'u1', user: {}, updatedAt: 1, lastDigestAt: null }]);
    await expect(service.all()).resolves.toEqual([DEFAULT_PREFERENCES]);
  });
});

describe('GithubService', () => {
  it('lista repos próprios com linguagens, sem forks/arquivados/vazios, e marca os académicos', async () => {
    const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.includes('/repos?')) {
        return Response.json([
          { name: 'radar', description: 'x', topics: ['nestjs'], fork: false, archived: false, stargazers_count: 2, pushed_at: 'd', languages_url: 'L1' },
          { name: 'fork', fork: true, archived: false, languages_url: 'L2' },
          { name: 'ED_2023_2024', fork: false, archived: false, stargazers_count: 0, pushed_at: 'd', languages_url: 'L3' },
          { name: 'vazio', fork: false, archived: false, stargazers_count: 0, pushed_at: 'd', languages_url: 'L4' },
        ]);
      }
      if (url === 'L1') return Response.json({ TypeScript: 10, CSS: 90 });
      if (url === 'L3') return Response.json({ C: 5 });
      return Response.json({});
    });
    vi.stubGlobal('fetch', fetch);
    const repos = await new GithubService(fakeConfig({ GITHUB_TOKEN: 't' })).repos('pedro');
    expect(repos.map((r) => r.name)).toEqual(['radar', 'ED_2023_2024']);
    expect(repos[0]!.languages).toEqual(['CSS', 'TypeScript']);
    expect(repos[1]!.academic).toBe(true);
    const init = fetch.mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t');
  });

  it('erro do GitHub → 502', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })));
    await expect(new GithubService(fakeConfig()).repos('x')).rejects.toBeInstanceOf(BadGatewayException);
  });
});

describe('ProfileService', () => {
  const cvJson = {
    title: 'Auxiliar', yearsExperience: 3, seniority: 'mid', skills: ['Primeiros Socorros'], languages: ['Portuguese'],
    location: 'Porto', summary: 'Trabalho com crianças.', sector: 'Educação/Creche', jobTitles: ['Auxiliar de Ação Educativa', 'Ama'],
  };
  function setup(prefs = DEFAULT_PREFERENCES) {
    const repo = fakeRepo();
    const github = { repos: vi.fn().mockResolvedValue([{ name: 'r' }]) };
    const preferences = { get: vi.fn().mockResolvedValue(prefs), update: vi.fn() };
    const service = new ProfileService(
      repo as never, fakeConfig({ GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm1', GEMINI_FALLBACK_MODEL: 'm2' }),
      github as never, preferences as never,
    );
    return { service, repo, github, preferences };
  }

  it('primeiro CV: guarda o perfil e preenche área e funções (sem apagar nada)', async () => {
    const { service, repo, preferences } = setup();
    gen.mockResolvedValue({ text: JSON.stringify(cvJson) });
    repo.findOneBy.mockResolvedValue({ userId: 'u1', ...cvJson });
    await service.saveFromCv('u1', Buffer.from('%PDF-'));
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1', sector: 'Educação/Creche', suggestedRoles: cvJson.jobTitles, source: 'cv',
    }));
    expect(preferences.update).toHaveBeenCalledWith('u1', {
      areas: ['Educação/Creche'], sector: 'Educação/Creche', roles: cvJson.jobTitles,
    });
  });

  it('IT pela primeira vez recebe as palavras escondidas de IT', async () => {
    const { service, repo, preferences } = setup();
    gen.mockResolvedValue({ text: JSON.stringify({ ...cvJson, sector: 'Tecnologia' }) });
    repo.findOneBy.mockResolvedValue({});
    await service.saveFromCv('u1', Buffer.from('%PDF-'));
    expect(preferences.update.mock.calls[0]![1].excludeKeywords).toEqual(IT_EXCLUDES);
    expect(preferences.update.mock.calls[0]![1].areas).toEqual(['Informática']);
  });

  it('não mexe no que a pessoa já escolheu', async () => {
    const { service, repo, preferences } = setup({
      ...DEFAULT_PREFERENCES, areas: ['Saúde/Cuidados'], sector: 'Saúde/Cuidados', roles: ['Enfermeira'],
    });
    gen.mockResolvedValue({ text: JSON.stringify(cvJson) });
    repo.findOneBy.mockResolvedValue({});
    await service.saveFromCv('u1', Buffer.from('%PDF-'), Buffer.from('%PDF-'));
    expect(preferences.update).not.toHaveBeenCalled();
  });

  it('área desconhecida vira "Outra"; usa o GitHub se houver; tenta o 2.º modelo', async () => {
    const { service, github } = setup();
    gen.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ text: JSON.stringify({ ...cvJson, sector: 'Marte' }) });
    const data = await service.extract(Buffer.from('%PDF-'), undefined, 'pedro');
    expect(data.sector).toBe('Outra');
    expect(github.repos).toHaveBeenCalledWith('pedro');
    expect(gen.mock.calls[1]![0].model).toBe('m2');
  });

  it('todos os modelos falham → 502; sem CV guardado → 404', async () => {
    const { service } = setup();
    gen.mockRejectedValue(new Error('x'));
    await expect(service.extract(Buffer.from('%PDF-'))).rejects.toBeInstanceOf(BadGatewayException);
    await expect(service.get('u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
