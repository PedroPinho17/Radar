import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccountController } from './account/account.module.js';
import { FeedbackController } from './account/feedback.controller.js';
import { AuthController } from './auth/auth.controller.js';
import { ApplicationsController } from './jobs/applications.controller.js';
import { DigestController } from './jobs/digest.controller.js';
import { JobsController } from './jobs/jobs.controller.js';
import { PreferencesController } from './profile/preferences.controller.js';
import { ProfileController } from './profile/profile.controller.js';
import { fakeResponse } from './testing/fakes.js';

const user = { id: 'u1', email: 'x@y.pt', emailVerified: true };
const ID = '6f9619ff-8b86-4d11-b42d-00c04fc964ff';
/** Serviço falso: qualquer método devolve { chamado: nome, args }. */
const spy = () =>
  new Proxy({} as Record<string, ReturnType<typeof vi.fn>>, {
    get: (t, k: string) => (t[k] ??= vi.fn(async (...args: unknown[]) => ({ chamado: k, args }))),
  });

afterEach(() => vi.unstubAllEnvs());

describe('AuthController', () => {
  it('liga cada rota ao serviço e abre sessão quando deve', async () => {
    const auth = spy();
    auth.register!.mockResolvedValue({ id: 'u1' });
    auth.login!.mockResolvedValue({ id: 'u1' });
    auth.resetPassword!.mockResolvedValue({ id: 'u1' });
    const c = new AuthController(auth as never);
    const res = fakeResponse() as never;
    await c.register({}, res);
    await c.login({}, res);
    await c.resetPassword({}, res);
    expect(auth.startSession).toHaveBeenCalledTimes(3);
    await c.forgotPassword({});
    await c.verifyEmail({});
    await c.resendVerification(user);
    await c.deleteAccount(user, { password: 'x' }, res);
    await c.changePassword(user, { sessionTokenHash: 'h' } as never, {});
    await c.logoutOthers(user, { sessionTokenHash: 'h' } as never);
    await c.logout({ sessionTokenHash: 'h' } as never, res);
    expect(auth.changePassword).toHaveBeenCalledWith('u1', 'h', {});
    expect(auth.endSession).toHaveBeenCalledWith('h', res);
    vi.stubEnv('ADMIN_EMAILS', 'x@y.pt');
    expect(c.me(user)).toEqual({ ...user, isAdmin: true });
  });
});

describe('JobsController', () => {
  it('rotas e validação do idioma da carta', async () => {
    const jobs = spy();
    const match = spy();
    const c = new JobsController(jobs as never, match as never);
    // ferramentas de depuração: só admins (os outros nem sabem que existem: 404)
    expect(() => c.sync(user)).toThrow(NotFoundException);
    expect(() => c.list(user)).toThrow(NotFoundException);
    expect(() => c.filtered(user)).toThrow(NotFoundException);
    vi.stubEnv('ADMIN_EMAILS', 'x@y.pt');
    await c.filtered(user);
    await c.list(user);
    await c.sync(user);
    expect(jobs.sync).toHaveBeenCalled();
    await c.matches(user);
    await c.match(user);
    await c.decide(user, ID, { decision: 'like' });
    await c.coverLetter(user, ID, { language: 'en' });
    await c.coverLetter(user, ID, undefined);
    expect(match.coverLetter).toHaveBeenLastCalledWith('u1', ID, undefined);
    expect(() => c.coverLetter(user, ID, { language: 'fr' })).toThrow(BadRequestException);
  });
});

describe('ApplicationsController / DigestController / PreferencesController', () => {
  it('delegam no serviço', async () => {
    const apps = spy();
    const a = new ApplicationsController(apps as never);
    await a.list(user);
    await a.apply(user, {});
    await a.updateStatus(user, ID, {});
    expect(apps.updateStatus).toHaveBeenCalledWith('u1', ID, {});

    const prefs = spy();
    const p = new PreferencesController(prefs as never);
    await p.get(user);
    await p.update(user, { x: 1 });
    expect(prefs.update).toHaveBeenCalledWith('u1', { x: 1 });
  });

  it('email de teste só com email confirmado', async () => {
    const digest = spy();
    const d = new DigestController(digest as never);
    expect(() => d.sendNow({ ...user, emailVerified: false })).toThrow('Confirma primeiro');
    await d.sendNow(user);
    expect(digest.sendFor).toHaveBeenCalledWith(user, { manual: true });
  });
});

describe('ProfileController', () => {
  const pdf = (s = '%PDF-1.7') => ({ buffer: Buffer.from(s) }) as Express.Multer.File;
  const setup = (githubUsername: string | null = 'pedro') => {
    const profile = spy();
    const github = spy();
    const prefs = { get: vi.fn().mockResolvedValue({ githubUsername }) };
    return { profile, github, c: new ProfileController(profile as never, github as never, prefs as never) };
  };

  it('aceita só PDFs a sério (pelos bytes, não pela extensão)', async () => {
    const { c, profile } = setup();
    expect(() => c.upload(user, {})).toThrow('Envia o CV');
    expect(() => c.upload(user, { cv: [pdf('MZ executável')] })).toThrow('tem de ser um PDF');
    expect(() => c.upload(user, { cv: [pdf()], linkedin: [pdf('<html>')] })).toThrow('LinkedIn');
    await c.upload(user, { cv: [pdf()], linkedin: [pdf()] });
    expect(profile.saveFromCv).toHaveBeenCalled();
    await c.get(user);
  });

  it('GitHub só se estiver nas preferências', async () => {
    await expect(setup(null).c.github(user)).rejects.toBeInstanceOf(BadRequestException);
    const { c, github } = setup('pedro');
    await c.github(user);
    expect(github.repos).toHaveBeenCalledWith('pedro');
  });
});

describe('AccountController / FeedbackController', () => {
  it('exportar, primeiros passos e feedback (admin para listar/resolver)', async () => {
    const account = spy();
    const a = new AccountController(account as never);
    await a.export(user);
    await a.onboarding(user);
    expect(account.onboarding).toHaveBeenCalledWith(user);

    const feedback = spy();
    const f = new FeedbackController(feedback as never);
    await f.create(user, {});
    expect(() => f.list(user)).toThrow(NotFoundException);
    expect(() => f.resolve(user, ID)).toThrow(NotFoundException);
    vi.stubEnv('ADMIN_EMAILS', 'x@y.pt');
    await f.list(user);
    await f.resolve(user, ID);
    expect(feedback.resolve).toHaveBeenCalledWith(ID);
  });
});
