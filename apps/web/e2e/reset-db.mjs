// Recria a base de dados dos testes de ponta a ponta (radar_e2e). As tabelas são criadas pela
// API ao arrancar (migrações), por isso cada execução começa do zero. Nunca toca na base "radar".
import pg from 'pg';

const admin = new pg.Client({ connectionString: 'postgres://radar:radar@127.0.0.1:5434/radar' });
await admin.connect();
await admin.query('DROP DATABASE IF EXISTS radar_e2e WITH (FORCE)');
await admin.query('CREATE DATABASE radar_e2e');
await admin.end();
console.log('[e2e] base de dados radar_e2e recriada');
