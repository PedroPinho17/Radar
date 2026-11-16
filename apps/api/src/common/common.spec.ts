import { HttpException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser, IS_PUBLIC } from '../auth/auth.decorators.js';
import { fakeConfig, fakeResponse } from '../testing/fakes.js';
import { isAdmin } from './admin.js';
import { withLock } from './db-lock.js';
import { RateLimit, RateLimitGuard } from './rate-limit.js';

const mailer = vi.hoisted(() => ({ sendMail: vi.fn(), createTransport: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: mailer.createTransport } }));

/** A função do método (onde o @RateLimit guarda os metadados), sem a chamar. */
const handlerOf = (cls: { prototype: object }, name: string) => (cls.prototype as Record<string, object>)[name]!;

function ctx(handler: object, req: object, res = fakeResponse()) {
  return {
    getHandler: () => handler,
    getClass: () => class Controlador {},
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as never;
}

describe('isAdmin', () => {
  it('lê ADMIN_EMAILS (sem maiúsculas nem espaços)', () => {
    vi.stubEnv('ADMIN_EMAILS', ' A@x.pt ,b@y.pt,');
    expect(isAdmin('a@X.pt')).toBe(true);
    expect(isAdmin('c@z.pt')).toBe(false);
    vi.unstubAllEnvs();
    expect(isAdmin('a@x.pt')).toBe(false);
  });
});

describe('withLock', () => {
  const runner = (locked: boolean) => ({
    connect: vi.fn(), release: vi.fn(),
    query: vi.fn(async (sql: string) => (sql.includes('try') ? [{ locked }] : [])),
  });

  it('corre quando o lock está livre e liberta-o sempre (mesmo com erro)', async () => {
    const r = runner(true);
    const db = { createQueryRunner: () => r };
    await expect(withLock(db as never, 'k', async () => 42)).resolves.toEqual({ ran: true, value: 42 });
    await expect(withLock(db as never, 'k', async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(r.query.mock.calls.filter(([sql]) => sql.includes('unlock'))).toHaveLength(2);
    expect(r.release).toHaveBeenCalledTimes(2);
  });

  it('não corre se outra instância tem o lock', async () => {
    const r = runner(false);
    const fn = vi.fn();
    await expect(withLock({ createQueryRunner: () => r } as never, 'k', fn)).resolves.toEqual({ ran: false });
    expect(fn).not.toHaveBeenCalled();
    expect(r.release).toHaveBeenCalled();
  });
});

describe('RateLimitGuard', () => {
  it('deixa passar até ao limite, depois 429 com Retry-After; separa por utilizador', () => {
    const guard = new RateLimitGuard(new Reflector());
    class C { @RateLimit({ limit: 2, windowMs: 60_000, by: 'user' }) acao() {} }
    const handler = handlerOf(C, 'acao');
    const res = fakeResponse();
    const ana = { ip: '1.1.1.1', user: { id: 'ana' } };
    expect(guard.canActivate(ctx(handler, ana, res))).toBe(true);
    expect(guard.canActivate(ctx(handler, ana, res))).toBe(true);
    const err = (() => { try { guard.canActivate(ctx(handler, ana, res)); } catch (e) { return e; } })() as HttpException;
    expect(err.getStatus()).toBe(429);
    expect(err.message).toContain('daqui a');
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    // outra pessoa no mesmo IP não é afetada
    expect(guard.canActivate(ctx(handler, { ip: '1.1.1.1', user: { id: 'rui' } }))).toBe(true);
    guard.onModuleDestroy();
  });

  it('sem regra: passa; "global" junta toda a gente; sem sessão conta por IP', () => {
    const guard = new RateLimitGuard(new Reflector());
    class C {
      livre() {}
      @RateLimit({ limit: 1, windowMs: 60_000, by: 'global' }) global() {}
      @RateLimit({ limit: 1, windowMs: 60_000, by: 'user' }) porUser() {}
    }
    expect(guard.canActivate(ctx(handlerOf(C, 'livre'), {}))).toBe(true);
    expect(guard.canActivate(ctx(handlerOf(C, 'global'), { ip: 'a' }))).toBe(true);
    expect(() => guard.canActivate(ctx(handlerOf(C, 'global'), { ip: 'b' }))).toThrow(HttpException);
    expect(guard.canActivate(ctx(handlerOf(C, 'porUser'), { ip: 'x' }))).toBe(true);
    expect(() => guard.canActivate(ctx(handlerOf(C, 'porUser'), { ip: 'x' }))).toThrow(HttpException);
    guard.onModuleDestroy();
  });
});

describe('AuthGuard', () => {
  const auth = {
    readToken: vi.fn(),
    validate: vi.fn(),
    hasCookie: vi.fn(),
    clearCookie: vi.fn(),
  };
  const reflector = { getAllAndOverride: vi.fn() };
  const guard = new AuthGuard(auth as never, reflector as unknown as Reflector);

  it('rotas públicas passam sem sessão', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(true);
    await expect(guard.canActivate(ctx(() => {}, {}))).resolves.toBe(true);
    expect(reflector.getAllAndOverride.mock.calls[0]![0]).toBe(IS_PUBLIC);
  });

  it('sessão válida põe o utilizador no pedido', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    auth.readToken.mockReturnValue('t');
    auth.validate.mockResolvedValue({ user: { id: 'u1' }, tokenHash: 'h' });
    const req: Record<string, unknown> = {};
    await expect(guard.canActivate(ctx(() => {}, req))).resolves.toBe(true);
    expect(req).toMatchObject({ user: { id: 'u1' }, sessionTokenHash: 'h' });
  });

  it('sessão inválida → 401 e apaga o cookie velho', async () => {
    auth.readToken.mockReturnValue(null);
    auth.hasCookie.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await expect(guard.canActivate(ctx(() => {}, {}))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.clearCookie).toHaveBeenCalledTimes(1);
    await expect(guard.canActivate(ctx(() => {}, {}))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.clearCookie).toHaveBeenCalledTimes(1);
  });
});

describe('CurrentUser', () => {
  it('é definido como decorador de parâmetro', () => {
    expect(typeof CurrentUser).toBe('function');
  });
});

describe('MailService', () => {
  it('envia (465 = SSL), avisa o monitor do resultado e repassa erros', async () => {
    mailer.createTransport.mockReturnValue({ sendMail: mailer.sendMail });
    const { MailService } = await import('../mail/mail.service.js');
    const mail = new MailService(fakeConfig({ SMTP_HOST: 'smtp', SMTP_PORT: '465', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'Radar <r@x.pt>' }));
    expect(mailer.createTransport.mock.calls[0]![0]).toMatchObject({ host: 'smtp', port: 465, secure: true });
    const results: unknown[] = [];
    mail.onResult = (ok, error) => results.push([ok, error]);

    mailer.sendMail.mockResolvedValueOnce({});
    await mail.send('a@b.pt', 'Olá', '<p>x</p>', { text: 'x', headers: { 'X-A': '1' } });
    expect(mailer.sendMail.mock.calls[0]![0]).toMatchObject({ from: 'Radar <r@x.pt>', to: 'a@b.pt', text: 'x', headers: { 'X-A': '1' } });

    mailer.sendMail.mockRejectedValueOnce(new Error('recusado'));
    await expect(mail.send('a@b.pt', 'Olá', '<p>x</p>')).rejects.toThrow('recusado');
    expect(results).toEqual([[true, undefined], [false, 'recusado']]);

    new MailService(fakeConfig({ SMTP_HOST: 'smtp', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'r', SMTP_PORT: '587' }));
    expect(mailer.createTransport.mock.calls[1]![0].secure).toBe(false);
  });
});
