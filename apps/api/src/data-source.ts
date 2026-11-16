import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';

/** Pasta compilada (dist), com barras normais: o glob do TypeORM não gosta das barras do Windows. */
const dir = import.meta.dirname.replace(/\\/g, '/');

/** Opções partilhadas pela app e pela linha de comandos das migrações. */
export const dataSourceOptions = (url = process.env.DATABASE_URL): DataSourceOptions => ({
  type: 'postgres',
  url,
  entities: [`${dir}/**/*.entity.js`],
  migrations: [`${dir}/migrations/*.js`],
  migrationsTableName: 'migrations',
  synchronize: false, // o esquema muda SÓ por migrações (nunca adivinhado no arranque)
});

/** Usado por `pnpm db:*` (ver package.json). */
export default new DataSource(dataSourceOptions());
