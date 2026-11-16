import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

/** Envio de emails via SMTP (Nodemailer). Usado por auth, digest e alertas. */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  /** Chamado depois de cada envio (o MonitorService usa-o para saber se o email está a funcionar). */
  onResult?: (ok: boolean, error?: string) => void;

  constructor(config: ConfigService) {
    const port = Number(config.get('SMTP_PORT') ?? 465);
    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port,
      secure: port === 465, // 465 = SSL direto; 587 = STARTTLS
      auth: {
        user: config.getOrThrow<string>('SMTP_USER'),
        pass: config.getOrThrow<string>('SMTP_PASS'),
      },
    });
    this.from = config.getOrThrow<string>('MAIL_FROM');
  }

  /** Envia um email. `text` = versão sem HTML (melhora a entrega); `headers` extra (ex.: List-Unsubscribe). */
  async send(to: string, subject: string, html: string, opts: { text?: string; headers?: Record<string, string> } = {}) {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html, text: opts.text, headers: opts.headers });
    } catch (err) {
      this.onResult?.(false, (err as Error).message);
      throw err;
    }
    this.onResult?.(true);
    this.logger.log(`Email "${subject}" enviado`);
  }
}
