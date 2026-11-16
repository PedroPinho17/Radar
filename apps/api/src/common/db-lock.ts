import type { DataSource } from 'typeorm';

export type LockResult<T> = { ran: true; value: T } | { ran: false };

/**
 * Corre `fn` só se nenhuma outra instância da API (nem outro pedido) estiver a correr a mesma tarefa.
 * Usa um advisory lock do Postgres: funciona entre processos/máquinas que partilham a base de dados
 * e é libertado sozinho se o processo morrer (a ligação fecha).
 */
export async function withLock<T>(db: DataSource, key: string, fn: () => Promise<T>): Promise<LockResult<T>> {
  const runner = db.createQueryRunner();
  await runner.connect();
  try {
    const rows = (await runner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [key])) as { locked: boolean }[];
    if (!rows[0]?.locked) return { ran: false };
    try {
      return { ran: true, value: await fn() };
    } finally {
      await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [key]);
    }
  } finally {
    await runner.release();
  }
}
