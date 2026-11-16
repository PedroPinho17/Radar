/** Ajudantes partilhados pelos testes (não entram na cobertura). */
import type { ConfigService } from '@nestjs/config';
import type { Mock } from 'vitest';

export type FakeRepo = Record<
  'find' | 'findOne' | 'findOneBy' | 'existsBy' | 'save' | 'insert' | 'update' | 'delete' | 'create' | 'count',
  Mock
>;

/** Repositório TypeORM falso: cada método é um vi.fn() com uma resposta neutra por omissão. */
export function fakeRepo(): FakeRepo {
  return {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    findOneBy: vi.fn().mockResolvedValue(null),
    existsBy: vi.fn().mockResolvedValue(false),
    save: vi.fn(async (x: unknown) => x),
    insert: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
    delete: vi.fn().mockResolvedValue({ affected: 0 }),
    create: vi.fn((x: unknown) => x),
    count: vi.fn().mockResolvedValue(0),
  };
}

/** ConfigService falso a partir de um objeto simples. */
export function fakeConfig(values: Record<string, string | undefined> = {}) {
  return {
    get: vi.fn((k: string) => values[k]),
    getOrThrow: vi.fn((k: string) => {
      if (values[k] === undefined) throw new Error(`falta ${k}`);
      return values[k];
    }),
  } as unknown as ConfigService;
}

/** Response do Express falsa (cookies, status, headers). */
export function fakeResponse() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
    status: vi.fn(),
    setHeader: vi.fn(),
  };
}

/** Espera que as tarefas em segundo plano (void promise) terminem. */
export const flush = () => new Promise((r) => setTimeout(r, 0));
