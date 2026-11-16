import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';

/** Acesso direto à base de testes, para o que um utilizador faria fora do site (abrir o email). */
export async function sql<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: 'postgres://radar:radar@127.0.0.1:5434/radar_e2e' });
  await client.connect();
  try {
    return (await client.query(query, params)).rows as T[];
  } finally {
    await client.end();
  }
}

/** Cria um link de confirmação de email válido (como o que chegaria por email) e devolve o token. */
export async function verificationToken(email: string) {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  await sql(
    `INSERT INTO email_verifications ("tokenHash", "userId", "expiresAt")
     SELECT $1, id, now() + interval '1 hour' FROM users WHERE email = $2`,
    [hash, email],
  );
  return token;
}
