import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service.js';

type SourceState = {
  ok: boolean;
  lastCount: number | null;
  lastOkAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
};
type Check = { lastOkAt: string | null; lastErrorAt: string | null; lastError: string | null; failures: number };

const HOUR = 60 * 60 * 1000;
/** O mesmo alerta não se repete antes de… */
const ALERT_EVERY = 6 * HOUR;
/** Uma fonte só gera alerta à N-ésima falha seguida (uma falha isolada é normal). */
const SOURCE_FAILS_TO_ALERT = 2;

const now = () => new Date().toISOString();
const emptyCheck = (): Check => ({ lastOkAt: null, lastErrorAt: null, lastError: null, failures: 0 });

/**
 * Sabe se as peças do Radar estão a funcionar (fontes de ofertas, emails, IA, resumos)
 * e avisa por email (ALERT_EMAIL) quando algo falha. O estado vive em memória:
 * recomeça a cada arranque, o que chega para saber "está a funcionar agora?".
 */
@Injectable()
export class MonitorService {
  private readonly logger = new Logger(MonitorService.name);
  private readonly startedAt = now();
  private readonly alertTo?: string;
  private readonly alerted = new Map<string, number>();
  private sendingAlert = false;

  private readonly sources = new Map<string, SourceState>();
  private lastSyncAt: string | null = null;
  private readonly mail = emptyCheck();
  private readonly ai = emptyCheck();
  private digest = { lastRunAt: null as string | null, sent: 0, skipped: 0, failed: 0, lastError: null as string | null };

  constructor(private readonly mailer: MailService, config: ConfigService) {
    this.alertTo = config.get<string>('ALERT_EMAIL') || undefined;
    mailer.onResult = (ok, error) => this.record(this.mail, ok, error);
  }

  private record(check: Check, ok: boolean, error?: string) {
    if (ok) {
      check.lastOkAt = now();
      check.failures = 0;
    } else {
      check.lastErrorAt = now();
      check.lastError = error ?? 'erro desconhecido';
      check.failures++;
    }
  }

  // ---------------------------------------------------------------- registos

  /** Resultado de uma fonte de ofertas num sync. */
  source(name: string, result: { count: number } | { error: string }) {
    const s = this.sources.get(name) ?? {
      ok: true, lastCount: null, lastOkAt: null, lastErrorAt: null, lastError: null, consecutiveFailures: 0,
    };
    if ('count' in result) {
      if (s.consecutiveFailures >= SOURCE_FAILS_TO_ALERT) this.logger.log(`Fonte ${name} voltou a funcionar`);
      Object.assign(s, { ok: true, lastCount: result.count, lastOkAt: now(), consecutiveFailures: 0 });
    } else {
      Object.assign(s, { ok: false, lastErrorAt: now(), lastError: result.error, consecutiveFailures: s.consecutiveFailures + 1 });
      if (s.consecutiveFailures >= SOURCE_FAILS_TO_ALERT) {
        void this.alert(`source:${name}`, `A fonte ${name} está a falhar`, [
          `Falhou ${s.consecutiveFailures} vezes seguidas.`,
          `Último erro: ${result.error}`,
          s.lastOkAt ? `Último sucesso: ${s.lastOkAt}` : 'Ainda não funcionou desde o arranque.',
        ]);
      }
    }
    this.sources.set(name, s);
  }

  syncFinished() {
    this.lastSyncAt = now();
  }

  /** Resultado de uma ronda de avaliação pela IA. */
  aiRun(pending: number, scored: number, lastError?: string) {
    if (!pending) return;
    if (scored > 0) return this.record(this.ai, true);
    this.record(this.ai, false, lastError ?? `0 de ${pending} ofertas avaliadas`);
    void this.alert('ai', 'A IA não está a avaliar ofertas', [
      `Nenhuma de ${pending} ofertas foi avaliada.`,
      `Último erro: ${this.ai.lastError}`,
      'Verifica as chaves e quotas do Gemini/Groq.',
    ]);
  }

  /** Resultado de uma ronda de resumos por email. */
  digestRun(r: { sent: number; skipped: number; failed: number; errors: string[] }) {
    this.digest = { lastRunAt: now(), sent: r.sent, skipped: r.skipped, failed: r.failed, lastError: r.errors.at(-1) ?? null };
    if (r.failed) {
      void this.alert('digest', `${r.failed} resumo(s) falharam`, [
        `Enviados: ${r.sent} · sem novidades: ${r.skipped} · falhados: ${r.failed}`,
        ...r.errors.slice(0, 5).map((e) => `• ${e}`),
      ]);
    }
  }

  // ---------------------------------------------------------------- estado

  status(): 'ok' | 'degraded' {
    const sourceDown = [...this.sources.values()].some((s) => s.consecutiveFailures >= SOURCE_FAILS_TO_ALERT);
    return sourceDown || this.mail.failures > 0 || this.ai.failures > 0 || this.digest.failed > 0 ? 'degraded' : 'ok';
  }

  snapshot() {
    return {
      status: this.status(),
      startedAt: this.startedAt,
      alertsTo: this.alertTo ? 'configurado' : 'não configurado (ALERT_EMAIL)',
      lastSyncAt: this.lastSyncAt,
      sources: Object.fromEntries(this.sources),
      mail: this.mail,
      ai: this.ai,
      digest: this.digest,
    };
  }

  // ---------------------------------------------------------------- alertas

  /** Envia um alerta por email (no máximo um por tipo a cada 6h). Sem ALERT_EMAIL, só regista no log. */
  private async alert(key: string, subject: string, lines: string[]) {
    this.logger.warn(`${subject} — ${lines.join(' | ')}`);
    const last = this.alerted.get(key) ?? 0;
    if (!this.alertTo || this.sendingAlert || Date.now() - last < ALERT_EVERY) return;
    this.alerted.set(key, Date.now());
    this.sendingAlert = true;
    try {
      const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
      const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">
        <h2 style="color:#b45309;margin:0 0 12px">⚠ ${esc(subject)}</h2>
        ${lines.map((l) => `<p style="margin:0 0 6px">${esc(l)}</p>`).join('')}
        <p style="color:#71717a;font-size:12px;margin-top:16px">Alerta automático do Radar. Não se repete nas próximas 6 horas.</p></div>`;
      await this.mailer.send(this.alertTo, `[Radar] ⚠ ${subject}`, html, { text: `${subject}\n\n${lines.join('\n')}` });
    } catch (err) {
      this.logger.error(`Não consegui enviar o alerta: ${(err as Error).message}`);
    } finally {
      this.sendingAlert = false;
    }
  }
}
