import { expect, test, type Page } from '@playwright/test';
import { sql, verificationToken } from './db';

/**
 * A história completa de um utilizador novo (não-IT), do primeiro clique até apagar a conta.
 * Corre em série: cada passo continua do anterior.
 */
test.describe.configure({ mode: 'serial' });

const EMAIL = `e2e-${Date.now()}@example.com`;
const PASSWORD = 'Uma-Frase-Boa-2026';
let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});
test.afterAll(async () => page.close());

test('página de apresentação → criar conta (com consentimento)', async () => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/bem-vindo$/); // sem sessão, a página inicial é a apresentação
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ter contigo');

  await page.getByRole('link', { name: 'Criar conta', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Criar conta' })).toHaveAttribute('aria-selected', 'true');

  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await expect(page.getByText('Forte')).toBeVisible(); // barra de força da password

  // o "olhinho" mostra a password
  await page.getByRole('button', { name: 'Mostrar password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');

  // sem aceitar os termos não dá
  await page.getByRole('button', { name: 'Criar conta' }).click();
  // (o Next tem outro role="alert", o anunciador de páginas: filtra pelo texto)
  await expect(page.getByRole('alert').filter({ hasText: 'aceitar os Termos' })).toBeVisible();

  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('Primeiros passos')).toBeVisible();
  await expect(page.getByText('0 de 4 feitos')).toBeVisible();
  await expect(page.getByText(/Confirma o teu email: enviámos um link/)).toBeVisible();

  const [row] = await sql<{ consent: boolean; verified: boolean }>(
    'SELECT "termsAcceptedAt" IS NOT NULL AS consent, "emailVerifiedAt" IS NOT NULL AS verified FROM users WHERE email = $1', [EMAIL]);
  expect(row).toEqual({ consent: true, verified: false });
});

test('confirmar o email pelo link', async () => {
  const token = await verificationToken(EMAIL);
  await page.goto(`/confirmar-email#token=${token}`);
  await expect(page.getByRole('heading', { name: 'Email confirmado!' })).toBeVisible();
  await expect(page).toHaveURL(/\/confirmar-email$/); // o token sai logo da barra de endereço

  await page.getByRole('link', { name: 'Continuar para o meu perfil' }).click();
  await expect(page.getByText(/Confirma o teu email: enviámos/)).toBeHidden();
});

test('perfil sem CV (formulário) para área não-informática', async () => {
  await page.goto('/perfil');
  // o Perfil tem dois formulários com campos parecidos (perfil e preferências): usa só o do perfil
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Guardar perfil' }) });
  await form.getByRole('button', { name: 'Educação/Creche' }).click();
  await form.getByLabel('Função que procuras').fill('Auxiliar de Ação Educativa');
  await form.getByLabel('Distrito').selectOption('Porto');
  await form.getByLabel('Cidade', { exact: true }).fill('Porto');
  await form.getByLabel('Anos de experiência').selectOption('3');
  await form.getByLabel('Escolaridade').selectOption('12.º ano');
  await form.getByRole('button', { name: 'Guardar perfil' }).click();
  await expect(page.getByText('Perfil guardado.')).toBeVisible();
  await expect(page.getByText('Auxiliar de Ação Educativa').first()).toBeVisible();
});

test('preferências: funções, cidade com gralha corrigida, guardar e confirmar', async () => {
  await page.goto('/perfil');
  await expect(page.getByRole('button', { name: 'Educação/Creche' }).first()).toBeVisible();
  await expect(page.getByLabel('GitHub')).toBeHidden(); // GitHub só aparece para IT

  const roles = page.getByRole('combobox', { name: 'Funções que procuras' });
  await roles.fill('Auxiliar de Ação Educativa');
  await roles.press('Enter');

  const cities = page.getByRole('combobox', { name: 'Outras cidades onde aceitas ir' });
  await cities.fill('Olievira de Azemeis');
  await cities.press('Enter');
  await expect(page.getByRole('button', { name: 'Remover Oliveira de Azeméis' })).toBeVisible();

  await page.getByRole('button', { name: 'Dias úteis' }).click();
  await expect(page.getByText(/de segunda a sexta/)).toBeVisible();

  await expect(page.getByText('Tens alterações por guardar')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Preferências guardadas.')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Remover Auxiliar de Ação Educativa' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remover Oliveira de Azeméis' })).toBeVisible();

  const [prefs] = await sql<{ areas: string[]; emailDays: number[] }>(
    'SELECT p.areas, p."emailDays" FROM preferences p JOIN users u ON u.id = p."userId" WHERE u.email = $1', [EMAIL]);
  if (!prefs) throw new Error('preferências não encontradas');
  expect(prefs.areas).toContain('Educação/Creche');
  expect(prefs.emailDays).toEqual([1, 2, 3, 4, 5]);
});

test('reportar um problema', async () => {
  await page.goto('/candidaturas');
  await page.getByRole('button', { name: 'Reportar um problema' }).click();
  await page.getByLabel('O que se passa?').selectOption('sugestao');
  await page.getByLabel('Mensagem').fill('Gostava de poder filtrar por horário de trabalho.');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByRole('heading', { name: 'Obrigado!' })).toBeVisible();

  const [fb] = await sql<{ type: string; page: string }>(
    'SELECT f.type, f.page FROM feedback f JOIN users u ON u.id = f."userId" WHERE u.email = $1', [EMAIL]);
  expect(fb).toEqual({ type: 'sugestao', page: '/candidaturas' });
});

test('sair e voltar a entrar (password errada primeiro)', async () => {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Terminar sessão' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/perfil');
  await expect(page).toHaveURL(/\/login$/); // sem sessão, páginas privadas pedem login

  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill('password-errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Email ou password incorretos' })).toBeVisible();

  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('esqueci-me da password: resposta igual exista ou não a conta', async ({ browser }) => {
  const other = await browser.newPage();
  await other.goto('/login');
  await other.getByLabel('Email').fill('nao-existe@example.com');
  await other.getByRole('link', { name: 'Esqueceste-te da password?' }).click();
  await expect(other.getByLabel('Email')).toHaveValue('nao-existe@example.com');
  await other.getByRole('button', { name: 'Enviar link' }).click();
  await expect(other.getByRole('heading', { name: 'Vê o teu email' })).toBeVisible();
  await other.close();
});

test('ficheiros públicos abrem sem sessão (robots.txt)', async ({ request }) => {
  const res = await request.get('/robots.txt', { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('Allow: /bem-vindo');
});

test('cabeçalhos de segurança', async ({ request }) => {
  const res = await request.get('/bem-vindo');
  expect(res.headers()['x-frame-options']).toBe('DENY');
  expect(res.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(res.headers()['x-powered-by']).toBeUndefined();
});

test('apagar a conta (RGPD): pede a password e apaga tudo', async () => {
  await page.goto('/perfil#seguranca');
  await page.getByRole('button', { name: 'Apagar conta' }).click();
  await page.getByLabel('A tua password').fill(PASSWORD);
  const confirm = page.getByRole('button', { name: 'Apagar a minha conta' });
  await expect(confirm).toBeDisabled(); // falta escrever APAGAR
  await page.getByLabel('Escreve APAGAR para confirmar').fill('apagar');
  await confirm.click();
  await expect(page).toHaveURL(/\/login$/);

  const rows = await sql('SELECT 1 FROM users WHERE email = $1', [EMAIL]);
  expect(rows).toHaveLength(0);
  const orphans = await sql('SELECT 1 FROM feedback UNION ALL SELECT 1 FROM preferences');
  expect(orphans).toHaveLength(0); // apagado em cascata
});
