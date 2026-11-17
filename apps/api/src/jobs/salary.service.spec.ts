import { fakeConfig } from '../testing/fakes.js';
import { SalaryService } from './salary.service.js';

const answer = (value: unknown, status = 200) =>
  new Response(JSON.stringify({ salario_anual_eur: value }), { status });

afterEach(() => vi.unstubAllGlobals());

describe('SalaryService', () => {
  it('sem SALARY_API_URL fica desligado e nem tenta', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const s = new SalaryService(fakeConfig());
    expect(s.enabled).toBe(false);
    await expect(s.estimate('Dev', 1, [])).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('pede a estimativa, arredonda às centenas e guarda em cache', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => answer(24_049));
    vi.stubGlobal('fetch', fetch);
    const s = new SalaryService(fakeConfig({ SALARY_API_URL: 'http://py:8000/' }));
    await expect(s.estimate('Backend Developer', 1, ['SQL', 'Python'])).resolves.toBe(24_000);
    // mesma pergunta (skills por outra ordem / maiúsculas): vem da cache
    await expect(s.estimate('backend developer', 1, ['python', 'sql'])).resolves.toBe(24_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBe('http://py:8000/estimate');
  });

  it('pedidos iguais em simultâneo = um só pedido; no máximo 4 ao mesmo tempo', async () => {
    let active = 0;
    let peak = 0;
    const fetch = vi.fn(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return answer(30_000);
    });
    vi.stubGlobal('fetch', fetch);
    const s = new SalaryService(fakeConfig({ SALARY_API_URL: 'http://py:8000' }));
    const titles = ['A', 'A', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const results = await Promise.all(titles.map((t) => s.estimate(t, 2, ['x'])));
    expect(results.every((r) => r === 30_000)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(7); // A só uma vez
    expect(peak).toBeLessThanOrEqual(4);
  });

  it('envia a localização e não mistura na cache ofertas iguais de países diferentes', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const { location } = JSON.parse(init!.body as string) as { location: string | null };
      return answer(location === 'Remoto (USA)' ? 90_000 : 30_000);
    });
    vi.stubGlobal('fetch', fetch);
    const s = new SalaryService(fakeConfig({ SALARY_API_URL: 'http://py:8000' }));
    await expect(s.estimate('Dev', 2, [], 'Lisboa')).resolves.toBe(30_000);
    await expect(s.estimate('Dev', 2, [], 'Remoto (USA)')).resolves.toBe(90_000);
    await expect(s.estimate('Dev', 2, [], '  ')).resolves.toBe(30_000); // vazio → sem localização
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetch.mock.calls[2]![1]!.body as string)).toMatchObject({ location: null });
  });

  it('ignora respostas implausíveis (e não volta a perguntar o mesmo)', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(answer(1)).mockResolvedValueOnce(answer('muito'));
    vi.stubGlobal('fetch', fetch);
    const s = new SalaryService(fakeConfig({ SALARY_API_URL: 'http://py:8000' }));
    await expect(s.estimate('A', 1, [])).resolves.toBeNull();
    await expect(s.estimate('A', 1, [])).resolves.toBeNull();
    await expect(s.estimate('B', 1, [])).resolves.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('em baixo: devolve null e não insiste durante 1 minuto (sem guardar a falha)', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')).mockResolvedValue(answer(40_000));
    vi.stubGlobal('fetch', fetch);
    const s = new SalaryService(fakeConfig({ SALARY_API_URL: 'http://py:8000' }));
    await expect(s.estimate('A', 1, [])).resolves.toBeNull();
    await expect(s.estimate('A', 1, [])).resolves.toBeNull(); // em pausa
    expect(fetch).toHaveBeenCalledTimes(1);

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000); // passou o minuto
    await expect(s.estimate('A', 1, [])).resolves.toBe(40_000);
    vi.restoreAllMocks();
  });

  it('erro HTTP conta como em baixo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(0, 500)));
    const s = new SalaryService(fakeConfig({ SALARY_API_URL: 'http://py:8000' }));
    await expect(s.estimate('A', 1, [])).resolves.toBeNull();
  });
});
