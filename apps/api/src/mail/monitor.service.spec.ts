import type { ConfigService } from '@nestjs/config';
import type { MailService } from './mail.service.js';
import { MonitorService } from './monitor.service.js';

function setup(alertEmail?: string) {
  const mailer = { send: vi.fn().mockResolvedValue(undefined) } as unknown as MailService & { send: ReturnType<typeof vi.fn> };
  const config = { get: () => alertEmail } as unknown as ConfigService;
  return { monitor: new MonitorService(mailer, config), mailer };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('MonitorService', () => {
  it('uma falha isolada de uma fonte não alerta; duas seguidas sim (uma vez)', async () => {
    const { monitor, mailer } = setup('admin@example.com');
    monitor.source('itjobs', { error: 'ITJobs respondeu 500.' });
    await flush();
    expect(mailer.send).not.toHaveBeenCalled();
    expect(monitor.status()).toBe('ok');

    monitor.source('itjobs', { error: 'ITJobs respondeu 500.' });
    monitor.source('itjobs', { error: 'ITJobs respondeu 500.' });
    await flush();
    expect(mailer.send).toHaveBeenCalledTimes(1); // não repete nas 6h seguintes
    expect(mailer.send.mock.calls[0]![1]).toContain('itjobs');
    expect(monitor.status()).toBe('degraded');

    monitor.source('itjobs', { count: 120 });
    expect(monitor.status()).toBe('ok');
  });

  it('sem ALERT_EMAIL não envia nada (só regista)', async () => {
    const { monitor, mailer } = setup(undefined);
    monitor.source('wwr', { error: 'x' });
    monitor.source('wwr', { error: 'x' });
    await flush();
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('IA: alerta só quando nenhuma oferta foi avaliada', async () => {
    const { monitor, mailer } = setup('admin@example.com');
    monitor.aiRun(10, 3);
    monitor.aiRun(0, 0); // nada para avaliar: não é erro
    await flush();
    expect(mailer.send).not.toHaveBeenCalled();
    monitor.aiRun(10, 0, 'quota excedida');
    await flush();
    expect(mailer.send).toHaveBeenCalledTimes(1);
    expect(monitor.snapshot().ai.lastError).toBe('quota excedida');
  });

  it('falhas de envio de email ficam visíveis no estado', () => {
    const { monitor, mailer } = setup();
    (mailer as MailService).onResult?.(false, 'SMTP recusou a ligação');
    expect(monitor.status()).toBe('degraded');
    expect(monitor.snapshot().mail.lastError).toBe('SMTP recusou a ligação');
    (mailer as MailService).onResult?.(true);
    expect(monitor.status()).toBe('ok');
  });
});
