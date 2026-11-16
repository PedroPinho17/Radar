import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Limites de uma estimativa plausível (€ brutos/ano); fora disto a resposta é ignorada. */
const MIN_EUR = 5_000;
const MAX_EUR = 500_000;
/** Estimativas guardadas em memória (o modelo não muda enquanto a API corre). */
const CACHE_MAX = 2_000;
/** Pedidos em simultâneo ao serviço Python. */
const CONCURRENCY = 4;
const TIMEOUT_MS = 3_000;
const PAUSE_AFTER_FAILURE_MS = 60_000;

/**
 * Pede ao salary-predictor (Python, SALARY_API_URL) um salário estimado para ofertas que não o dizem.
 * Opcional: sem URL, em baixo ou com resposta estranha, devolve null e o site simplesmente não mostra estimativa.
 */
@Injectable()
export class SalaryService {
  private readonly logger = new Logger(SalaryService.name);
  private readonly url: string | undefined;
  private readonly cache = new Map<string, number | null>();
  /** Pedidos iguais em curso partilham a mesma resposta (vários cartões com o mesmo título). */
  private readonly inflight = new Map<string, Promise<number | null>>();
  private downUntil = 0; // depois de uma falha, não insiste durante 1 minuto
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(config: ConfigService) {
    this.url = config.get<string>('SALARY_API_URL')?.replace(/\/+$/, '') || undefined;
  }

  get enabled() {
    return !!this.url;
  }

  /** Salário bruto anual estimado (€, arredondado às centenas), ou null. */
  async estimate(title: string, years: number, skills: string[]): Promise<number | null> {
    if (!this.url || Date.now() < this.downUntil) return null;
    const key = `${title.trim().toLowerCase()}|${years}|${[...skills].sort().join(',').toLowerCase()}`;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const pending = this.inflight.get(key);
    if (pending) return pending;

    const request = this.withSlot(() => this.request(title, years, skills)).then((value) => {
      if (value !== undefined) this.remember(key, value); // undefined = falha de rede: não guardar
      return value ?? null;
    });
    this.inflight.set(key, request);
    try {
      return await request;
    } finally {
      this.inflight.delete(key);
    }
  }

  /** undefined = falhou (tentar mais tarde); null = o serviço respondeu mas sem valor plausível. */
  private async request(title: string, years: number, skills: string[]): Promise<number | null | undefined> {
    if (Date.now() < this.downUntil) return undefined;
    try {
      const res = await fetch(`${this.url}/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, years, skills }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const value = ((await res.json()) as { salario_anual_eur?: unknown }).salario_anual_eur;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < MIN_EUR || value > MAX_EUR) {
        this.logger.warn(`Estimativa ignorada (fora do plausível): ${String(value)}`);
        return null;
      }
      return Math.round(value / 100) * 100;
    } catch (err) {
      this.downUntil = Date.now() + PAUSE_AFTER_FAILURE_MS;
      this.logger.warn(`API de salários indisponível: ${(err as Error).message}`);
      return undefined;
    }
  }

  /** Cache com limite: quando enche, sai a entrada mais antiga. */
  private remember(key: string, value: number | null) {
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, value);
  }

  /** No máximo CONCURRENCY pedidos ao mesmo tempo; os outros esperam a vez. */
  private async withSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= CONCURRENCY) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}
