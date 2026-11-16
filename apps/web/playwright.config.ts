import { defineConfig } from '@playwright/test';

/**
 * Testes de ponta a ponta: API + site a sério, numa base de dados à parte (radar_e2e).
 * Portas próprias (3201/3200) e build próprio (.next-e2e): não mexem no ambiente de desenvolvimento.
 * Precisa do Postgres do docker compose ligado. Correr: pnpm --filter web test:e2e
 */
const API = 'http://127.0.0.1:3201';
const WEB = 'http://localhost:3200';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1, // os testes seguem uma história (registo → … → apagar conta)
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB,
    channel: 'chrome', // usa o Chrome instalado (sem descarregar browsers)
    locale: 'pt-PT',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      cwd: '../api',
      command: 'node ../web/e2e/reset-db.mjs && npx nest build && node --use-system-ca dist/main.js',
      url: `${API}/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        PORT: '3201',
        DATABASE_URL: 'postgres://radar:radar@127.0.0.1:5434/radar_e2e',
        WEB_URL: WEB,
        ALLOWED_ORIGINS: WEB,
        SYNC_ON_BOOT: 'false', // não ir aos sites de emprego
        SMTP_HOST: '127.0.0.1', // nenhum email sai dos testes
        SMTP_PORT: '2525',
        ALERT_EMAIL: '',
        ADMIN_EMAILS: '',
      } as Record<string, string>,
    },
    {
      command: 'npx next build && npx next start -p 3200',
      url: `${WEB}/bem-vindo`,
      timeout: 300_000,
      reuseExistingServer: false,
      env: { ...process.env, API_URL: API, NEXT_DIST_DIR: '.next-e2e' } as Record<string, string>,
    },
  ],
});
