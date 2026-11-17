import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, HttpException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { fakeConfig, fakeRepo, fakeResponse, flush, type FakeRepo } from '../testing/fakes.js';
import type { MailService } from '../mail/mail.service.js';
import { AuthService } from './auth.service.js';
import { hashPassword } from './password.js';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const TOKEN = 'a'.repeat(43);

function setup(env: Record<string, string> = {}) {
  const users = fakeRepo();
  const sessions = fakeRepo();
  const resets = fakeRepo();
  const verifications = fakeRepo();
  const mail = { send: vi.fn().mockResolvedValue(undefined) } as unknown as MailService & { send: ReturnType<typeof vi.fn> };
  const service = new AuthService(
    users as never, sessions as never, resets as never, verifications as never, mail,
    fakeConfig({ WEB_URL: 'https://radar.test/', ...env }),
  );
  return { service, users, sessions, resets, verifications, mail };
}

afterEach(() => vi.restoreAllMocks());

describe('AuthService · registo', () => {
  it('cria a conta com consentimento e envia o email de confirmação', async () => {
    const { service, users, verifications, mail } = setup();
    users.save.mockImplementation(async (u: object) => ({ id: 'u1', ...u }));
    const user = await service.register({ email: ' Ana@Exemplo.PT ', password: 'Uma-Frase-Boa-1', acceptTerms: true });

    expect(user).toMatchObject({ id: 'u1', email: 'ana@exemplo.pt' });
    const created = users.create.mock.calls[0]![0];
    expect(created.passwordHash).toMatch(/^scrypt\$/);
    expect(created.termsAcceptedAt).toBeInstanceOf(Date);

    await flush();
    await flush();
    expect(verifications.insert).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }));
    const [to, subject, html, opts] = mail.send.mock.calls[0]!;
    expect(to).toBe('ana@exemplo.pt');
    expect(subject).toContain('confirma');
    expect(html).toContain('https://radar.test/confirmar-email#token=');
    expect(opts.text).toContain('CONFIRMA O TEU EMAIL'); // a versão em texto põe os títulos em maiúsculas
  });

  it.each([
    [{ email: 'x@y.pt', password: 'Uma-Frase-Boa-1' }, 'Política de Privacidade'],
    [{ email: 'nao-e-email', password: 'Uma-Frase-Boa-1', acceptTerms: true }, 'Email inválido'],
    [{ email: 'x@y.pt', password: 'curta', acceptTerms: true }, '8 caracteres'],
    [{ email: 'x@y.pt', password: 'password1', acceptTerms: true }, 'demasiado comum'],
    [{ email: 'x@y.pt', password: 'aaaaaaaaab', acceptTerms: true }, 'repetitiva'],
  ])('recusa dados inválidos (%o)', async (body, msg) => {
    const { service } = setup();
    await expect(service.register(body)).rejects.toThrow(msg);
  });

  it('email repetido → 409', async () => {
    const { service, users } = setup();
    const dup = new QueryFailedError('insert', [], Object.assign(new Error('dup'), { code: '23505' }));
    users.save.mockRejectedValue(dup);
    await expect(service.register({ email: 'x@y.pt', password: 'Uma-Frase-Boa-1', acceptTerms: true }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('outros erros da BD passam', async () => {
    const { service, users } = setup();
    users.save.mockRejectedValue(new Error('BD em baixo'));
    await expect(service.register({ email: 'x@y.pt', password: 'Uma-Frase-Boa-1', acceptTerms: true }))
      .rejects.toThrow('BD em baixo');
  });

  it('falha no envio do email de confirmação não estraga o registo', async () => {
    const { service, users, mail } = setup();
    users.save.mockImplementation(async (u: object) => ({ id: 'u1', ...u }));
    mail.send.mockRejectedValue(new Error('SMTP'));
    await expect(service.register({ email: 'x@y.pt', password: 'Uma-Frase-Boa-1', acceptTerms: true })).resolves.toBeTruthy();
    await flush();
  });
});

describe('AuthService · login', () => {
  it('entra com a password certa', async () => {
    const { service, users } = setup();
    users.findOne.mockResolvedValue({ id: 'u1', email: 'x@y.pt', passwordHash: await hashPassword('Certa-123') });
    await expect(service.login({ email: 'X@y.pt', password: 'Certa-123' })).resolves.toMatchObject({ id: 'u1' });
  });

  it('password errada e conta inexistente dão a MESMA resposta', async () => {
    const { service, users } = setup();
    users.findOne.mockResolvedValueOnce({ id: 'u1', email: 'x@y.pt', passwordHash: await hashPassword('Certa-123') });
    const wrong = await service.login({ email: 'x@y.pt', password: 'errada' }).catch((e: Error) => e);
    users.findOne.mockResolvedValueOnce(null);
    const missing = await service.login({ email: 'nao@existe.pt', password: 'errada' }).catch((e: Error) => e);
    expect(wrong).toBeInstanceOf(UnauthorizedException);
    expect(missing).toBeInstanceOf(UnauthorizedException);
    expect((wrong as Error).message).toBe((missing as Error).message);
  });

  it('bloqueia após 8 falhas seguidas na mesma conta', async () => {
    const { service } = setup();
    for (let i = 0; i < 8; i++) await service.login({ email: 'x@y.pt', password: 'errada' }).catch(() => {});
    const err = await service.login({ email: 'x@y.pt', password: 'errada' }).catch((e: Error) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
    service.onModuleDestroy();
  }, 15_000); // 9 logins com scrypt (lento de propósito): os 5 s por omissão ficam à justa

  it('pede a password', async () => {
    const { service } = setup();
    await expect(service.login({ email: 'x@y.pt', password: '' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AuthService · recuperar password', () => {
  it('responde sempre igual e só envia email se a conta existir', async () => {
    const { service, users, resets, mail } = setup();
    users.findOneBy.mockResolvedValueOnce(null);
    await expect(service.forgotPassword({ email: 'nao@existe.pt' })).resolves.toEqual({ ok: true });
    await flush();
    expect(mail.send).not.toHaveBeenCalled();

    users.findOneBy.mockResolvedValueOnce({ id: 'u1', email: 'x@y.pt' });
    await expect(service.forgotPassword({ email: 'x@y.pt' })).resolves.toEqual({ ok: true });
    await flush();
    await flush();
    expect(resets.delete).toHaveBeenCalledWith({ userId: 'u1' }); // só o link mais recente vale
    expect(mail.send.mock.calls[0]![2]).toContain('https://radar.test/redefinir-password#token=');
  });

  it('no máximo 3 emails por hora para a mesma conta', async () => {
    const { service, users, mail } = setup();
    users.findOneBy.mockResolvedValue({ id: 'u1', email: 'x@y.pt' });
    for (let i = 0; i < 5; i++) await service.forgotPassword({ email: 'x@y.pt' });
    await flush();
    await flush();
    expect(mail.send).toHaveBeenCalledTimes(3);
  });

  it('erro no envio fica só no log', async () => {
    const { service, users } = setup();
    users.findOneBy.mockRejectedValue(new Error('BD'));
    await expect(service.forgotPassword({ email: 'x@y.pt' })).resolves.toEqual({ ok: true });
    await flush();
  });

  it('redefine com token válido: nova password, sessões fechadas, email confirmado', async () => {
    const { service, users, resets, sessions } = setup();
    resets.findOne.mockResolvedValue({ userId: 'u1', user: { id: 'u1', email: 'x@y.pt', emailVerifiedAt: null } });
    const user = await service.resetPassword({ token: TOKEN, password: 'Nova-Frase-9' });

    expect(resets.findOne.mock.calls[0]![0].where.tokenHash).toBe(sha256(TOKEN));
    const update = users.update.mock.calls[0]![1];
    expect(update.passwordHash).toMatch(/^scrypt\$/);
    expect(update.emailVerifiedAt).toBeInstanceOf(Date);
    expect(sessions.delete).toHaveBeenCalledWith({ userId: 'u1' });
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('token inválido ou expirado → 400', async () => {
    const { service } = setup();
    await expect(service.resetPassword({ token: TOKEN, password: 'Nova-Frase-9' })).rejects.toThrow('expirou');
    await expect(service.resetPassword({ token: 'curto', password: 'Nova-Frase-9' })).rejects.toThrow('Link inválido');
  });
});

describe('AuthService · confirmação de email', () => {
  it('confirma com o link e apaga os links da pessoa', async () => {
    const { service, users, verifications } = setup();
    verifications.findOne.mockResolvedValue({ userId: 'u1', user: { email: 'x@y.pt' } });
    await expect(service.verifyEmail({ token: TOKEN })).resolves.toEqual({ ok: true, email: 'x@y.pt' });
    expect(users.update).toHaveBeenCalledWith({ id: 'u1' }, { emailVerifiedAt: expect.any(Date) });
    expect(verifications.delete).toHaveBeenCalledWith({ userId: 'u1' });
  });

  it('link inválido → 400', async () => {
    const { service } = setup();
    await expect(service.verifyEmail({ token: TOKEN })).rejects.toThrow('inválido ou já expirou');
  });

  it('reenvia só a quem ainda não confirmou', async () => {
    const { service, mail } = setup();
    await expect(service.resendVerification({ id: 'u1', email: 'x@y.pt', emailVerified: true }))
      .resolves.toEqual({ ok: true, alreadyVerified: true });
    expect(mail.send).not.toHaveBeenCalled();
    await expect(service.resendVerification({ id: 'u1', email: 'x@y.pt', emailVerified: false }))
      .resolves.toEqual({ ok: true, alreadyVerified: false });
    expect(mail.send).toHaveBeenCalledTimes(1);
  });
});

describe('AuthService · conta', () => {
  it('muda a password e fecha as OUTRAS sessões', async () => {
    const { service, users, sessions } = setup();
    users.findOne.mockResolvedValue({ id: 'u1', passwordHash: await hashPassword('Atual-123') });
    await expect(service.changePassword('u1', 'hash-atual', { currentPassword: 'Atual-123', newPassword: 'Nova-Frase-9' }))
      .resolves.toEqual({ ok: true });
    const where = sessions.delete.mock.calls[0]![0];
    expect(where.userId).toBe('u1');
    expect(where.tokenHash).toBeDefined(); // Not(hash-atual)
  });

  it('recusa password atual errada ou igual à nova', async () => {
    const { service, users } = setup();
    users.findOne.mockResolvedValue({ id: 'u1', passwordHash: await hashPassword('Atual-123') });
    await expect(service.changePassword('u1', undefined, { currentPassword: 'errada', newPassword: 'Nova-Frase-9' }))
      .rejects.toThrow('atual está errada');
    await expect(service.changePassword('u1', undefined, { currentPassword: 'Atual-123', newPassword: 'Atual-123' }))
      .rejects.toThrow('diferente');
  });

  it('termina as outras sessões', async () => {
    const { service, sessions } = setup();
    sessions.delete.mockResolvedValue({ affected: 2 });
    await expect(service.logoutOthers('u1', 'h')).resolves.toEqual({ closed: 2 });
    sessions.delete.mockResolvedValue({});
    await expect(service.logoutOthers('u1', undefined)).resolves.toEqual({ closed: 0 });
    expect(sessions.delete).toHaveBeenLastCalledWith({ userId: 'u1' });
  });

  it('apaga a conta só com a password certa', async () => {
    const { service, users } = setup();
    const res = fakeResponse();
    users.findOne.mockResolvedValue({ id: 'u1', passwordHash: await hashPassword('Certa-123') });
    await expect(service.deleteAccount('u1', { password: 'errada' }, res as unknown as Response)).rejects.toThrow('errada');
    expect(users.delete).not.toHaveBeenCalled();
    await service.deleteAccount('u1', { password: 'Certa-123' }, res as unknown as Response);
    expect(users.delete).toHaveBeenCalledWith({ id: 'u1' });
    expect(res.clearCookie).toHaveBeenCalled();
  });
});

describe('AuthService · sessões', () => {
  it('abre sessão: guarda só o hash e põe o cookie httpOnly', async () => {
    const { service, sessions } = setup();
    const res = fakeResponse();
    const dto = await service.startSession({ id: 'u1', email: 'x@y.pt', emailVerifiedAt: null } as never, res as unknown as Response);
    expect(dto).toEqual({ id: 'u1', email: 'x@y.pt', emailVerified: false });
    const [name, token, opts] = res.cookie.mock.calls[0]!;
    expect(name).toBe('sid');
    expect(opts).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: false });
    expect(sessions.insert.mock.calls[0]![0].tokenHash).toBe(sha256(token));
  });

  it('em produção usa __Host-sid e Secure', async () => {
    const { service } = setup({ NODE_ENV: 'production' });
    const res = fakeResponse();
    await service.startSession({ id: 'u1', email: 'x', emailVerifiedAt: new Date() } as never, res as unknown as Response);
    expect(res.cookie.mock.calls[0]![0]).toBe('__Host-sid');
    expect(res.cookie.mock.calls[0]![2].secure).toBe(true);
  });

  it('valida, termina e lê o cookie', async () => {
    const { service, sessions } = setup();
    sessions.findOne.mockResolvedValueOnce({ user: { id: 'u1', email: 'x@y.pt', emailVerifiedAt: new Date() } });
    await expect(service.validate(TOKEN)).resolves.toEqual({
      user: { id: 'u1', email: 'x@y.pt', emailVerified: true }, tokenHash: sha256(TOKEN),
    });
    await expect(service.validate(TOKEN)).resolves.toBeNull();

    const res = fakeResponse();
    await service.endSession('h', res as unknown as Response);
    expect(sessions.delete).toHaveBeenCalledWith({ tokenHash: 'h' });
    await service.endSession(undefined, res as unknown as Response);
    expect(res.clearCookie).toHaveBeenCalledTimes(2);

    const req = (cookie?: string) => ({ headers: { cookie } }) as Request;
    expect(service.readToken(req(`a=1; sid=${TOKEN}`))).toBe(TOKEN);
    expect(service.readToken(req('sid=mau'))).toBeNull();
    expect(service.readToken(req())).toBeNull();
    expect(service.hasCookie(req('sid=mau'))).toBe(true);
    expect(service.hasCookie(req('outro=1'))).toBe(false);
  });
});

export type { FakeRepo };
