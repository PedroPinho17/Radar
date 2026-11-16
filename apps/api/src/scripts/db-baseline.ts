/**
 * Adota as migrações numa base de dados que JÁ EXISTE (criada antes pelo `synchronize`).
 * Corre-se UMA VEZ por base de dados: `pnpm --filter api db:baseline`
 *
 * 1. Mostra o SQL que falta para o esquema ficar igual às entidades e aplica-o.
 *    Recusa se isso apagar alguma coisa (DROP), a não ser com --force.
 * 2. Contas que já existiam ficam com o email dado como confirmado (eram usadas antes de haver confirmação).
 * 3. Marca todas as migrações como já aplicadas. A partir daí, só `pnpm db:migrate`.
 *
 * Opções: --dry-run (só mostra o SQL), --force (aceita DROPs). Faz backup antes: pg_dump.
 */
import 'reflect-metadata';
import dataSource from '../data-source.js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');

const ds = await dataSource.initialize();
try {
  const table = ds.options.migrationsTableName ?? 'migrations';
  await ds.query(
    `CREATE TABLE IF NOT EXISTS "${table}" ("id" SERIAL PRIMARY KEY, "timestamp" bigint NOT NULL, "name" varchar NOT NULL)`,
  );
  const done = (await ds.query(`SELECT name FROM "${table}"`)) as { name: string }[];
  if (done.length) {
    console.log(`Esta base de dados já usa migrações (${done.length} aplicadas). Usa "pnpm db:migrate".`);
    process.exit(0);
  }

  const sql = (await ds.driver.createSchemaBuilder().log()).upQueries.map((q) => q.query);
  const drops = sql.filter((q) => /\bDROP\s+(COLUMN|TABLE)\b/i.test(q));
  console.log(sql.length ? `SQL para pôr o esquema em dia (${sql.length}):\n${sql.map((q) => `  ${q};`).join('\n')}` : 'O esquema já está em dia.');

  if (drops.length && !force) {
    console.error(`\n✘ Isto apagaria dados (${drops.length} DROP). Faz backup e confirma com --force se tiveres a certeza.`);
    process.exit(1);
  }
  if (dryRun) {
    console.log('\n(--dry-run: nada foi alterado)');
    process.exit(0);
  }

  await ds.synchronize();
  const verified = (await ds.query(
    `UPDATE users SET "emailVerifiedAt" = "createdAt", "termsAcceptedAt" = COALESCE("termsAcceptedAt", "createdAt")
      WHERE "emailVerifiedAt" IS NULL`,
  )) as [unknown, number];

  for (const m of ds.migrations) {
    const name = m.name ?? m.constructor.name;
    const timestamp = Number(name.match(/(\d{13})$/)?.[1] ?? Date.now());
    await ds.query(`INSERT INTO "${table}" ("timestamp", "name") VALUES ($1, $2)`, [timestamp, name]);
  }
  console.log(`\n✔ Esquema em dia, ${verified[1] ?? 0} conta(s) existentes dadas como confirmadas, ${ds.migrations.length} migração(ões) marcadas.`);
} finally {
  await ds.destroy();
}
