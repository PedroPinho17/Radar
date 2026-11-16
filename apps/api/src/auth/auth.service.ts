import { createHash, randomBytes } from 'node:crypto';
import { createElement } from 'react';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { CookieOptions, Request, Response } from 'express';
import { render } from 'react-email';
import { LessThan, MoreThan, Not, QueryFailedError, Repository } from 'typeorm';
import { z } from 'zod';
import { SlidingWindow, waitMessage } from '../common/rate-limit.js';
import { MailService } from '../mail/mail.service.js';
import { ActionEmail } from '../mail/action-email.js';
import type { UserDto } from './auth.decorators.js';
import { EmailVerification } from './email-verification.entity.js';
import { PasswordReset } from './password-reset.entity.js';
import { hashPassword, verifyPassword } from './password.js';
import { Session } from './session.entity.js';
import { User } from './user.entity.js';

/** Hash SHA-256 de um token (só o hash é guardado na BD). */
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Converte User da BD para o DTO exposto à API. */
const toDto = (u: Pick<User, 'id' | 'email' | 'emailVerifiedAt'>): UserDto => ({
  id: u.id,
  email: u.email,
  emailVerified: !!u.emailVerifiedAt,
});

/** Formato dos tokens (32 bytes em base64url = 43 chars). */
const TOKEN_RE = /^[\w-]{43}$/;
const newToken = () => randomBytes(32).toString('base64url');

/** Passwords demasiado óbvias, recusadas mesmo tendo 8+ caracteres. */
const COMMON = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'qwertyui', 'qwerty123', '11111111',
  '00000000', 'abcdefgh', 'iloveyou', 'abc12345', 'admin123', 'welcome1', 'benfica1', 'portugal',
  'sporting', 'fcporto1', 'palavrapasse', 'passw0rd',
]);

const email = z.string().trim().toLowerCase().max(254).email('Email inválido.');
const newPassword = z
  .string()
  .min(8, 'A password tem de ter pelo menos 8 caracteres.')
  .max(200, 'A password é demasiado longa.')
  .refine((p) => !COMMON.has(p.toLowerCase()), 'Essa password é demasiado comum. Escolhe outra.')
  .refine((p) => new Set(p).size >= 4, 'A password é demasiado repetitiva.');

const registerSchema = z.object({
  email,
  password: newPassword,
  acceptTerms: z.literal(true, { error: 'Para criar conta tens de aceitar os Termos e a Política de Privacidade.' }),
});
const loginSchema = z.object({ email, password: z.string().min(1, 'Indica a password.').max(200) });
const forgotSchema = z.object({ email });
const resetSchema = z.object({
  token: z.string().regex(TOKEN_RE, 'Link inválido. Pede um novo.'),
  password: newPassword,
});
const changeSchema = z.object({
  currentPassword: z.string().min(1, 'Indica a password atual.').max(200),
  newPassword,
});
const tokenSchema = z.object({ token: z.string().regex(TOKEN_RE, 'Link inválido.') });
const confirmSchema = z.object({ password: z.string().min(1, 'Indica a tua password para confirmar.').max(200) });

const MIN = 60 * 1000;
/** Bloqueio de login: N falhas na mesma conta dentro da janela. */
const LOGIN_FAILS = { limit: 8, windowMs: 15 * MIN };
/** Emails de recuperação por conta. */
const RESET_EMAILS = { limit: 3, windowMs: 60 * MIN };
const RESET_TTL_MIN = 30;
/** Validade do link de confirmação de email. */
const VERIFY_TTL_HOURS = 48;

/**
 * Auth por sessão em cookie httpOnly (não JWT).
 * O browser guarda o token; a BD guarda apenas o hash SHA-256.
 */
/**
 * Autenticação: registo, login, sessões (cookie), confirmação de email e reset de password.
 * Tokens sensíveis são guardados só como hash SHA-256.
 */
@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  /** Nome do cookie de sessão (`__Host-sid` em produção, `sid` em dev). */
  readonly cookieName: string;
  private readonly secure: boolean;
  private readonly webUrl: string;
  /** Duração da sessão: 30 dias. */
  private readonly ttlMs = 30 * 24 * 60 * 60 * 1000;
  private readonly attempts = new SlidingWindow();
  /** Hash falso para o login demorar o mesmo quando o email não existe. */
  private dummyHash?: Promise<string>;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(PasswordReset) private readonly resets: Repository<PasswordReset>,
    @InjectRepository(EmailVerification) private readonly verifications: Repository<EmailVerification>,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.secure = config.get('NODE_ENV') === 'production';
    this.cookieName = this.secure ? '__Host-sid' : 'sid';
    this.webUrl = (config.get<string>('WEB_URL') ?? 'http://localhost:3000').replace(/\/+$/, '');
  }

  onModuleDestroy() {
    this.attempts.stop();
  }

  /** Valida o body com Zod; lança 400 com a primeira mensagem de erro. */
  private parse<T>(schema: z.ZodType<T>, body: unknown): T {
    const result = schema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues[0]?.message ?? 'Dados inválidos.');
    return result.data;
  }

  // ---------------------------------------------------------------- registo e login

  /** Cria conta (com consentimento RGPD) e envia o email de confirmação; 409 se o email já existir. */
  async register(body: unknown): Promise<User> {
    const { email, password } = this.parse(registerSchema, body);
    try {
      const user = await this.users.save(
        this.users.create({ email, passwordHash: await hashPassword(password), termsAcceptedAt: new Date() }),
      );
      void this.sendVerificationEmail(user).catch((err: Error) =>
        this.logger.error(`Falha ao enviar email de confirmação: ${err.message}`),
      );
      return user;
    } catch (err) {
      if (err instanceof QueryFailedError && (err.driverError as { code?: string }).code === '23505') {
        throw new ConflictException('Já existe uma conta com este email. Queres entrar ou recuperar a password?');
      }
      throw err;
    }
  }

  /**
   * Autentica email/password; 401 se as credenciais estiverem erradas.
   * Demora o mesmo exista ou não a conta, e bloqueia após várias falhas seguidas.
   */
  async login(body: unknown): Promise<User> {
    const { email, password } = this.parse(loginSchema, body);
    const key = `login:${email}`;
    if (this.attempts.count(key, LOGIN_FAILS.windowMs) >= LOGIN_FAILS.limit) {
      const retry = this.attempts.retryAfter(key, LOGIN_FAILS.windowMs);
      throw new HttpException(
        `Demasiadas tentativas falhadas. Tenta outra vez ${waitMessage(retry)} ou recupera a password.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.users.findOne({
      where: { email },
      select: { id: true, email: true, passwordHash: true, emailVerifiedAt: true },
    });
    this.dummyHash ??= hashPassword(newToken());
    const ok = await verifyPassword(password, user?.passwordHash ?? (await this.dummyHash));
    if (!user || !ok) {
      this.attempts.add(key);
      throw new UnauthorizedException('Email ou password incorretos.');
    }
    this.attempts.reset(key);
    return user;
  }

  // ---------------------------------------------------------------- emails com link

  /** Envia um email com um botão, em HTML e em texto simples. */
  private async sendAction(to: string, subject: string, props: Parameters<typeof ActionEmail>[0]) {
    const el = createElement(ActionEmail, props);
    const [html, text] = await Promise.all([render(el), render(el, { plainText: true })]);
    await this.mail.send(to, subject, html, { text });
  }

  /** Envia (ou reenvia) o link para confirmar o email. Só o último link funciona. */
  private async sendVerificationEmail(user: Pick<User, 'id' | 'email'>) {
    await this.verifications.delete({ userId: user.id });
    const token = newToken();
    await this.verifications.insert({
      tokenHash: sha256(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + VERIFY_TTL_HOURS * 60 * MIN),
    });
    // token no fragmento (#): o browser nunca o envia a servidores nem no Referer
    await this.sendAction(user.email, 'Radar: confirma o teu email', {
      preview: 'Falta só um passo para começares a receber ofertas',
      title: 'Confirma o teu email',
      intro: 'Bem-vindo ao Radar! Confirma que este email é teu para começares a receber as ofertas que combinam contigo.',
      button: 'Confirmar email',
      link: `${this.webUrl}/confirmar-email#token=${token}`,
      note: `O link é válido durante ${VERIFY_TTL_HOURS} horas. Contas por confirmar são apagadas ao fim de 7 dias.`,
      footer: 'Não criaste uma conta no Radar? Ignora este email: a conta é apagada automaticamente.',
    });
  }

  /** Confirma o email com o token do link. */
  async verifyEmail(body: unknown) {
    const { token } = this.parse(tokenSchema, body);
    const row = await this.verifications.findOne({
      where: { tokenHash: sha256(token), expiresAt: MoreThan(new Date()) },
      relations: { user: true },
    });
    if (!row) throw new BadRequestException('Este link é inválido ou já expirou. Entra na tua conta para pedir um novo.');
    await this.users.update({ id: row.userId }, { emailVerifiedAt: new Date() });
    await this.verifications.delete({ userId: row.userId });
    return { ok: true, email: row.user.email };
  }

  async resendVerification(user: UserDto) {
    if (user.emailVerified) return { ok: true, alreadyVerified: true };
    await this.sendVerificationEmail(user);
    return { ok: true, alreadyVerified: false };
  }

  /**
   * Pede um link de recuperação. A resposta é sempre igual (não revela se a conta existe)
   * e o email é enviado em segundo plano para o tempo de resposta também não revelar.
   */
  async forgotPassword(body: unknown) {
    const { email } = this.parse(forgotSchema, body);
    const key = `reset:${email}`;
    if (this.attempts.count(key, RESET_EMAILS.windowMs) < RESET_EMAILS.limit) {
      this.attempts.add(key);
      void this.sendResetEmail(email).catch((err: Error) =>
        this.logger.error(`Falha ao enviar email de recuperação: ${err.message}`),
      );
    }
    return { ok: true };
  }

  private async sendResetEmail(email: string) {
    const user = await this.users.findOneBy({ email });
    if (!user) return;
    await this.resets.delete({ expiresAt: LessThan(new Date()) });
    await this.resets.delete({ userId: user.id }); // só o link mais recente funciona
    const token = newToken();
    await this.resets.insert({
      tokenHash: sha256(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_TTL_MIN * MIN),
    });
    await this.sendAction(user.email, 'Radar: redefinir a tua password', {
      preview: 'Redefine a tua password do Radar',
      title: 'Redefinir a password',
      intro: 'Recebemos um pedido para redefinir a password da tua conta. Carrega no botão para escolher uma nova.',
      button: 'Escolher nova password',
      link: `${this.webUrl}/redefinir-password#token=${token}`,
      note: `O link é válido durante ${RESET_TTL_MIN} minutos e só pode ser usado uma vez.`,
      footer: 'Não foste tu? Ignora este email: a tua password continua igual e ninguém entrou na tua conta.',
    });
  }

  /**
   * Troca a password com o token do email; termina todas as sessões abertas.
   * Abrir o link prova que o email é da pessoa, por isso também o dá como confirmado.
   */
  async resetPassword(body: unknown): Promise<User> {
    const { token, password } = this.parse(resetSchema, body);
    const reset = await this.resets.findOne({
      where: { tokenHash: sha256(token), expiresAt: MoreThan(new Date()) },
      relations: { user: true },
    });
    if (!reset) throw new BadRequestException('Este link é inválido ou já expirou. Pede um novo.');

    await this.resets.delete({ userId: reset.userId });
    const emailVerifiedAt = reset.user.emailVerifiedAt ?? new Date();
    await this.users.update({ id: reset.userId }, { passwordHash: await hashPassword(password), emailVerifiedAt });
    await this.sessions.delete({ userId: reset.userId });
    this.attempts.reset(`login:${reset.user.email}`);
    return Object.assign(reset.user, { emailVerifiedAt });
  }

  // ---------------------------------------------------------------- conta

  /** Muda a password com sessão iniciada; termina as outras sessões (outros dispositivos). */
  async changePassword(userId: string, currentTokenHash: string | undefined, body: unknown) {
    const { currentPassword, newPassword: next } = this.parse(changeSchema, body);
    const user = await this.users.findOne({ where: { id: userId }, select: { id: true, passwordHash: true } });
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new BadRequestException('A password atual está errada.');
    }
    if (currentPassword === next) throw new BadRequestException('A nova password tem de ser diferente da atual.');
    await this.users.update({ id: userId }, { passwordHash: await hashPassword(next) });
    await this.sessions.delete(currentTokenHash ? { userId, tokenHash: Not(currentTokenHash) } : { userId });
    return { ok: true };
  }

  /** Termina todas as sessões exceto a atual. */
  async logoutOthers(userId: string, currentTokenHash: string | undefined) {
    const { affected } = await this.sessions.delete(
      currentTokenHash ? { userId, tokenHash: Not(currentTokenHash) } : { userId },
    );
    return { closed: affected ?? 0 };
  }

  /** Apaga a conta e TUDO o que lhe pertence (em cascata na BD) e termina a sessão. Pede a password. */
  async deleteAccount(userId: string, body: unknown, res: Response) {
    const { password } = this.parse(confirmSchema, body);
    const user = await this.users.findOne({ where: { id: userId }, select: { id: true, passwordHash: true } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new BadRequestException('A password está errada.');
    }
    await this.users.delete({ id: userId });
    this.clearCookie(res);
    this.logger.log(`Conta ${userId} apagada a pedido do utilizador`);
  }

  // ---------------------------------------------------------------- sessões

  /**
   * Abre sessão: limpa expiradas, gera token, guarda o hash na BD
   * e define o cookie httpOnly na response.
   */
  async startSession(user: User, res: Response): Promise<UserDto> {
    await this.sessions.delete({ expiresAt: LessThan(new Date()) });
    const token = newToken();
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.sessions.insert({ tokenHash: sha256(token), userId: user.id, expiresAt });
    res.cookie(this.cookieName, token, { ...this.cookieOptions(), expires: expiresAt });
    return toDto(user);
  }

  /** Termina sessão: apaga o registo na BD e limpa o cookie. */
  async endSession(tokenHash: string | undefined, res: Response) {
    if (tokenHash) await this.sessions.delete({ tokenHash });
    this.clearCookie(res);
  }

  /** Valida o token do cookie contra a BD; devolve user + hash se a sessão for válida. */
  async validate(token: string) {
    const tokenHash = sha256(token);
    const session = await this.sessions.findOne({
      where: { tokenHash, expiresAt: MoreThan(new Date()) },
      relations: { user: true },
    });
    return session ? { user: toDto(session.user), tokenHash } : null;
  }

  /** Lê o token de sessão do header Cookie; null se em falta ou formato inválido. */
  readToken(req: Request): string | null {
    for (const part of (req.headers.cookie ?? '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0 && part.slice(0, i).trim() === this.cookieName) {
        const value = part.slice(i + 1).trim();
        return TOKEN_RE.test(value) ? value : null;
      }
    }
    return null;
  }

  /** true se o pedido traz um cookie de sessão (válido ou não). */
  hasCookie(req: Request) {
    return (req.headers.cookie ?? '').split(';').some((p) => p.trim().startsWith(`${this.cookieName}=`));
  }

  clearCookie(res: Response) {
    res.clearCookie(this.cookieName, this.cookieOptions());
  }

  /** Opções comuns do cookie: httpOnly, Secure em prod, SameSite=Lax. */
  private cookieOptions(): CookieOptions {
    return { httpOnly: true, secure: this.secure, sameSite: 'lax', path: '/' };
  }
}
