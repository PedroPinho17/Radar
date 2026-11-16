import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';
import { clearHash, hashParam, searchParam, storageValue } from './client-value';
import { CITIES, closestOption, editDistance, fuzzyMatches, isTech, normalize, ROLES_BY_SECTOR, SECTORS, TIME_SLOTS } from './options';
import { safeUrl } from './url';

afterEach(() => vi.unstubAllGlobals());

describe('options', () => {
  it('normaliza acentos e maiúsculas', () => {
    expect(normalize('  Oliveira de AZEMÉIS ')).toBe('oliveira de azemeis');
  });

  it('distância de edição', () => {
    expect(editDistance('olievira', 'oliveira')).toBe(2);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('porto', 'porto')).toBe(0);
  });

  it('encontra cidades mesmo com gralhas', () => {
    expect(closestOption('Olievira de Azemeis', CITIES)).toBe('Oliveira de Azeméis');
    expect(closestOption('Matozinhos', CITIES)).toBe('Matosinhos');
    expect(closestOption('Arrifana', CITIES)).toBeNull(); // cidade fora da lista: não inventa
    expect(closestOption('abc', CITIES)).toBeNull(); // curto demais para adivinhar
    expect(fuzzyMatches('olievira', CITIES)[0]).toBe('Oliveira de Azeméis');
    expect(fuzzyMatches('ab', CITIES)).toEqual([]);
  });

  it('áreas e horas', () => {
    expect(isTech(null)).toBe(true);
    expect(isTech([], 'Tecnologia')).toBe(true);
    expect(isTech(['Educação/Creche'])).toBe(false);
    expect(SECTORS).toContain('Outra');
    expect(SECTORS).toContain('Informática');
    expect(ROLES_BY_SECTOR['Educação/Creche']).toContain('Auxiliar de Ação Educativa');
    expect(TIME_SLOTS).toHaveLength(48);
    expect(TIME_SLOTS.slice(0, 3)).toEqual(['00:00', '00:30', '01:00']);
  });
});

describe('safeUrl', () => {
  it('só http(s)', () => {
    expect(safeUrl('https://x.pt/a')).toBe('https://x.pt/a');
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('não é url')).toBeUndefined();
    expect(safeUrl(null)).toBeUndefined();
  });
});

describe('api', () => {
  const respond = (status: number, body?: unknown) =>
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status })));

  it('envia JSON para /api e devolve a resposta', async () => {
    respond(200, { ok: 1 });
    await expect(api('/x', { method: 'POST', json: { a: 1 } })).resolves.toEqual({ ok: 1 });
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('/api/x');
    expect(init).toMatchObject({ body: '{"a":1}', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } });
  });

  it('204 → null', async () => {
    respond(204);
    await expect(api('/x')).resolves.toBeNull();
  });

  it('erros com mensagem da API (texto ou lista) e mensagens por omissão', async () => {
    respond(400, { message: 'Email inválido.' });
    await expect(api('/x')).rejects.toMatchObject({ message: 'Email inválido.', status: 400 });
    respond(400, { message: ['a', 'b'] });
    await expect(api('/x')).rejects.toThrow('a b');
    respond(429);
    await expect(api('/x')).rejects.toThrow('Demasiados pedidos');
    respond(500);
    await expect(api('/x')).rejects.toThrow('servidor teve um problema');
    respond(404);
    await expect(api('/x')).rejects.toThrow('Algo correu mal');
  });

  it('sem rede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = (await api("/x").catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.message).toContain('Sem ligação');
  });
});

describe('client-value', () => {
  function fakeWindow(url: string) {
    const u = new URL(url);
    const replaceState = vi.fn((_s: unknown, _t: string, next: string) => {
      const n = new URL(next, u);
      Object.assign(win.location, { pathname: n.pathname, search: n.search, hash: n.hash });
    });
    const win = { location: { pathname: u.pathname, search: u.search, hash: u.hash }, history: { replaceState } };
    vi.stubGlobal('window', win);
    return win;
  }

  it('lê parâmetros do URL', () => {
    fakeWindow('https://r.pt/login?modo=registo');
    expect(searchParam('modo')()).toBe('registo');
    expect(searchParam('outro')()).toBeNull();
  });

  it('guarda o token do fragmento antes de o apagar do URL', () => {
    const win = fakeWindow('https://r.pt/confirmar-email?x=1#token=abc');
    const read = hashParam('token');
    expect(read()).toBe('abc');
    clearHash();
    expect(win.history.replaceState).toHaveBeenCalledWith(null, '', '/confirmar-email?x=1');
    expect(win.location.hash).toBe('');
    expect(read()).toBe('abc'); // continua disponível depois de apagado
    clearHash(); // sem fragmento: não faz nada
    expect(win.history.replaceState).toHaveBeenCalledTimes(1);
  });

  it('localStorage, incluindo quando está bloqueado', () => {
    vi.stubGlobal('localStorage', { getItem: (k: string) => (k === 'a' ? '1' : null) });
    expect(storageValue('a')()).toBe('1');
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqueado'); } });
    expect(storageValue('a')()).toBeNull();
  });
});

describe('sources', () => {
  it('nomes legíveis e contagem por fonte (mais ofertas primeiro)', async () => {
    const { countBySource, sourceLabel } = await import('./sources');
    expect(sourceLabel('netempregos')).toBe('Net-Empregos');
    expect(sourceLabel('nova-fonte')).toBe('nova-fonte');
    const m = (source: string) => ({ job: { source } });
    expect(countBySource([m('itjobs'), m('netempregos'), m('netempregos'), m('jooble')])).toEqual([
      { source: 'netempregos', label: 'Net-Empregos', count: 2 },
      { source: 'itjobs', label: 'ITJobs', count: 1 },
      { source: 'jooble', label: 'Jooble', count: 1 },
    ]);
  });
});
