import {
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { AuthedRequest } from '../auth/auth.decorators.js';

/**
 * Janela deslizante em memória: conta eventos por chave nos últimos `windowMs`.
 * Chega para uma instância só; com várias réplicas passaria para Redis.
 */
export class SlidingWindow {
  private readonly hits = new Map<string, number[]>();
  private readonly timer: NodeJS.Timeout;

  constructor(private readonly maxWindowMs = 60 * 60 * 1000) {
    // limpa chaves antigas de 5 em 5 minutos para a memória não crescer sem fim
    this.timer = setInterval(() => this.prune(), 5 * 60 * 1000);
    this.timer.unref();
  }

  /** Quantos eventos há para a chave dentro da janela. */
  count(key: string, windowMs: number, now = Date.now()) {
    return (this.hits.get(key) ?? []).filter((t) => t > now - windowMs).length;
  }

  /** Segundos até sair o evento mais antigo da janela (para o Retry-After). */
  retryAfter(key: string, windowMs: number, now = Date.now()) {
    const first = (this.hits.get(key) ?? []).find((t) => t > now - windowMs);
    return first ? Math.max(1, Math.ceil((first + windowMs - now) / 1000)) : 1;
  }

  add(key: string, now = Date.now()) {
    const list = this.hits.get(key) ?? [];
    list.push(now);
    this.hits.set(key, list);
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  private prune(now = Date.now()) {
    for (const [key, list] of this.hits) {
      const fresh = list.filter((t) => t > now - this.maxWindowMs);
      if (fresh.length) this.hits.set(key, fresh);
      else this.hits.delete(key);
    }
  }

  stop() {
    clearInterval(this.timer);
  }
}

/** Mensagem amigável: "daqui a 3 minutos". */
export function waitMessage(seconds: number) {
  if (seconds < 60) return `daqui a ${seconds} segundo${seconds === 1 ? '' : 's'}`;
  const min = Math.ceil(seconds / 60);
  return `daqui a ${min} minuto${min === 1 ? '' : 's'}`;
}

export type RateLimitRule = {
  limit: number;
  windowMs: number;
  /** ip = por endereço; user = por conta (cai para IP se não houver sessão); global = todos juntos. */
  by?: 'ip' | 'user' | 'global';
};

const RATE_LIMIT = 'rateLimit';
const MIN = 60 * 1000;

/** Limita quantas vezes a rota pode ser chamada. Aceita várias regras (todas têm de passar). */
export const RateLimit = (...rules: RateLimitRule[]) => SetMetadata(RATE_LIMIT, rules);
export { MIN as MINUTE };

@Injectable()
export class RateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly window = new SlidingWindow(24 * 60 * MIN);

  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const rules = this.reflector.get<RateLimitRule[] | undefined>(RATE_LIMIT, ctx.getHandler());
    if (!rules?.length) return true;

    const http = ctx.switchToHttp();
    const req = http.getRequest<AuthedRequest>();
    const route = `${ctx.getClass().name}.${ctx.getHandler().name}`;
    const now = Date.now();

    const keys = rules.map((rule, i) => {
      const who = rule.by === 'global' ? '*' : rule.by === 'user' && req.user ? `u:${req.user.id}` : `ip:${req.ip}`;
      return `${route}:${i}:${who}`;
    });

    rules.forEach((rule, i) => {
      if (this.window.count(keys[i]!, rule.windowMs, now) >= rule.limit) {
        const retry = this.window.retryAfter(keys[i]!, rule.windowMs, now);
        http.getResponse<Response>().setHeader('Retry-After', String(retry));
        throw new HttpException(
          `Demasiados pedidos. Tenta outra vez ${waitMessage(retry)}.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    });
    keys.forEach((k) => this.window.add(k, now));
    return true;
  }

  onModuleDestroy() {
    this.window.stop();
  }
}
