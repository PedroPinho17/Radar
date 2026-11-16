import { BadRequestException, NotFoundException } from '@nestjs/common';
import { fakeConfig, fakeRepo, fakeResponse, flush, type FakeRepo } from '../testing/fakes.js';
import { AccountService } from './account.service.js';
import { FeedbackService } from './feedback.service.js';
import { HealthController } from './health.controller.js';

const lock = vi.hoisted(() => ({ keys: [] as string[] }));
vi.mock('../common/db-lock.js', () => ({
  withLock: async (_db: unknown, key: string, fn: () => Promise<unknown>) => {
    lock.keys.push(key);
    return { ran: true, value: await fn() };
  },
}));

const user = { id: 'u1', email: 'x@y.pt', emailVerified: true };

// ------------------------------------------------------------------ AccountService

const REPOS = ['users', 'profiles', 'prefs', 'matches', 'apps', 'sessions', 'resets', 'verifications', 'feedback'] as const;

function accountSetup() {
  const r = Object.fromEntries(REPOS.map((k) => [k, fakeRepo()])) as Record<(typeof REPOS)[number], FakeRepo>;
  const db = { query: vi.fn().mockResolvedValue([[], 3]) };
  const service = new AccountService(
    db as never, r.users as never, r.profiles as never, r.prefs as never, r.matches as never, r.apps as never,
    r.sessions as never, r.resets as never, r.verifications as never, r.feedback as never,
  );
  return { service, db, ...r };
}

describe('AccountService', () => {
  it('exporta todos os dados da pessoa (sem hash da password nem ids internos)', async () => {
    const s = accountSetup();
    const job = { title: 'T', company: 'C', location: 'L', url: 'u', source: 's', description: 'longa' };
    s.users!.findOneBy.mockResolvedValue({ email: 'x@y.pt', createdAt: 1, emailVerifiedAt: 2, termsAcceptedAt: 3, passwordHash: 'NUNCA' });
    s.profiles!.findOneBy.mockResolvedValue({ userId: 'u1', user: {}, title: 'Dev' });
    s.prefs!.findOneBy.mockResolvedValue(null);
    s.matches!.find.mockResolvedValue([{ job, score: 80, reasons: [], missingSkills: [], decision: null, decisionReason: null, coverLetter: null, createdAt: 1 }]);
    s.apps!.find.mockResolvedValue([{ job, status: 'applied', createdAt: 1, updatedAt: 1, events: [{ status: 'applied', note: null, createdAt: 1 }] }]);
    s.feedback!.find.mockResolvedValue([{ type: 'bug', message: 'm', page: '/', createdAt: 1 }]);

    const data = await s.service.export('u1');
    expect(JSON.stringify(data)).not.toContain('NUNCA');
    expect(data.profile).toEqual({ title: 'Dev' });
    expect(data.preferences).toBeNull();
    expect(data.matches[0]!.job).not.toHaveProperty('description');
    expect(data.applications[0]!.events).toHaveLength(1);
    expect(data.feedback).toHaveLength(1);
  });

  it('primeiros passos', async () => {
    const s = accountSetup();
    s.profiles!.existsBy.mockResolvedValue(true);
    s.prefs!.findOne.mockResolvedValue({ roles: ['Ama'], areas: ['Educação/Creche'], district: 'Porto', city: null, onsiteLocations: [] });
    await expect(s.service.onboarding(user)).resolves.toEqual({
      emailVerified: true, hasAreas: true, hasProfile: true, hasCv: true, hasPreferences: true, hasMatches: false, done: true,
    });
    s.prefs!.findOne.mockResolvedValue(null);
    await expect(s.service.onboarding({ ...user, emailVerified: false })).resolves.toMatchObject({ done: false, hasPreferences: false, hasAreas: false });
  });

  it('limpeza diária com lock; um erro não rebenta', async () => {
    const s = accountSetup();
    s.users!.delete.mockResolvedValue({ affected: 2 });
    await s.service.cleanup();
    expect(lock.keys).toContain('radar:cleanup');
    expect(s.sessions!.delete).toHaveBeenCalled();
    expect(s.db.query.mock.calls[0]![0]).toContain('DELETE FROM jobs');
    s.users!.delete.mockRejectedValue(new Error('BD'));
    await expect(s.service.cleanup()).resolves.toBeUndefined();
  });
});

// ------------------------------------------------------------------ FeedbackService

function feedbackSetup(alert?: string) {
  const feedback = fakeRepo();
  const matches = fakeRepo();
  const mail = { send: vi.fn().mockResolvedValue(undefined) };
  feedback.save.mockImplementation(async (f: object) => ({ id: 'f1', ...f }));
  const service = new FeedbackService(feedback as never, matches as never, mail as never, fakeConfig({ ALERT_EMAIL: alert }));
  return { service, feedback, matches, mail };
}

describe('FeedbackService', () => {
  it('guarda e avisa quem gere o Radar (com Reply-To da pessoa e HTML escapado)', async () => {
    const { service, feedback, mail } = feedbackSetup('admin@radar.pt');
    await expect(service.create(user, { type: 'bug', message: 'O botão <b>não</b> funciona', page: '/perfil' }))
      .resolves.toEqual({ id: 'f1', ok: true });
    expect(feedback.create.mock.calls[0]![0]).toMatchObject({ userId: 'u1', page: '/perfil', matchId: null });
    await flush();
    const [to, subject, html, opts] = mail.send.mock.calls[0]!;
    expect(to).toBe('admin@radar.pt');
    expect(subject).toContain('Erro no site');
    expect(html).toContain('&lt;b&gt;');
    expect(opts.headers['Reply-To']).toBe('x@y.pt');
  });

  it('oferta mal avaliada: só ofertas da própria pessoa, com contexto no aviso', async () => {
    const { service, matches, mail } = feedbackSetup('admin@radar.pt');
    const id = '6f9619ff-8b86-4d11-b42d-00c04fc964ff';
    await expect(service.create(user, { type: 'oferta', message: 'nota alta demais', matchId: id })).rejects.toBeInstanceOf(NotFoundException);
    matches.findOne.mockResolvedValue({ id, score: 90, reasons: ['a'], job: { title: 'Dev', company: 'ACME' } });
    await service.create(user, { type: 'oferta', message: 'nota alta demais', matchId: id });
    await flush();
    expect(mail.send.mock.calls[0]![3].text).toContain('Dev @ ACME (nota 90)');
  });

  it('valida; sem ALERT_EMAIL não envia; falha do SMTP não estraga', async () => {
    const { service, mail } = feedbackSetup();
    await expect(service.create(user, { type: 'bug', message: 'curto' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create(user, { type: 'x', message: 'mensagem comprida' })).rejects.toThrow('tipo');
    await expect(service.create(user, { type: 'bug', message: 'mensagem comprida', page: 'javascript:x' })).rejects.toThrow('Página');
    await service.create(user, { type: 'sugestao', message: 'mensagem comprida' });
    expect(mail.send).not.toHaveBeenCalled();

    const other = feedbackSetup('a@b.pt');
    other.mail.send.mockRejectedValue(new Error('SMTP'));
    await expect(other.service.create(user, { type: 'outro', message: 'mensagem comprida' })).resolves.toBeTruthy();
    await flush();
  });

  it('lista (por resolver primeiro) e resolve', async () => {
    const { service, feedback } = feedbackSetup();
    feedback.find.mockResolvedValue([
      { id: '1', resolvedAt: new Date(), user: { email: 'a' } },
      { id: '2', resolvedAt: null, user: null },
    ]);
    const list = await service.list();
    expect(list.map((f) => f.id)).toEqual(['2', '1']);
    expect(list[0]!.email).toBeNull();
    await expect(service.resolve('1')).resolves.toEqual({ ok: true });
    feedback.update.mockResolvedValue({ affected: 0 });
    await expect(service.resolve('9')).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ------------------------------------------------------------------ HealthController

describe('HealthController', () => {
  const monitor = { status: vi.fn(() => 'ok'), snapshot: vi.fn(() => ({ status: 'ok' })) };

  it('público: 200 com estado, 503 se a BD não responder', async () => {
    const res = fakeResponse();
    const ok = new HealthController({ query: vi.fn().mockResolvedValue([]) } as never, monitor as never);
    await expect(ok.health(res as never)).resolves.toMatchObject({ status: 'ok', database: 'ok' });
    expect(res.status).not.toHaveBeenCalled();

    const down = new HealthController({ query: vi.fn().mockRejectedValue(new Error('x')) } as never, monitor as never);
    await expect(down.health(res as never)).resolves.toMatchObject({ status: 'down', database: 'down' });
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('detalhes só para admins', async () => {
    const c = new HealthController({ query: vi.fn().mockResolvedValue([]) } as never, monitor as never);
    vi.stubEnv('ADMIN_EMAILS', 'Chefe@radar.pt, outro@x.pt');
    await expect(c.details({ ...user, email: 'x@y.pt' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(c.details({ ...user, email: 'chefe@RADAR.pt' })).resolves.toMatchObject({ status: 'ok', database: 'ok' });
    vi.unstubAllEnvs();
  });
});
