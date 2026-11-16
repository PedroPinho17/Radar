import { hashPassword, verifyPassword } from '../auth/password.js';
import { lisbonSlot } from '../jobs/digest.service.js';
import { SlidingWindow, waitMessage } from './rate-limit.js';

describe('SlidingWindow (rate limit)', () => {
  it('conta só os eventos dentro da janela', () => {
    const w = new SlidingWindow();
    w.add('k', 1_000);
    w.add('k', 5_000);
    expect(w.count('k', 10_000, 10_500)).toBe(2);
    expect(w.count('k', 10_000, 12_000)).toBe(1); // o de 1 000 já saiu
    expect(w.retryAfter('k', 10_000, 12_000)).toBe(3); // sai aos 15 000
    w.reset('k');
    expect(w.count('k', 10_000, 12_000)).toBe(0);
    w.stop();
  });

  it('mensagem de espera amigável', () => {
    expect(waitMessage(1)).toBe('daqui a 1 segundo');
    expect(waitMessage(90)).toBe('daqui a 2 minutos');
  });
});

describe('passwords', () => {
  it('hash scrypt verifica a certa e recusa a errada', async () => {
    const hash = await hashPassword('Uma-Frase-Boa-123');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash).not.toContain('Uma-Frase-Boa-123');
    expect(await verifyPassword('Uma-Frase-Boa-123', hash)).toBe(true);
    expect(await verifyPassword('uma-frase-boa-123', hash)).toBe(false);
  });

  it('cada hash tem sal próprio', async () => {
    expect(await hashPassword('igual-igual')).not.toBe(await hashPassword('igual-igual'));
  });

  it('recusa hashes mal formados sem rebentar', async () => {
    expect(await verifyPassword('x', 'lixo')).toBe(false);
  });
});

describe('lisbonSlot (agendamento dos emails)', () => {
  it('converte para a hora de Lisboa, com hora de verão', () => {
    expect(lisbonSlot(new Date('2026-07-06T07:30:10Z'))).toEqual({ weekday: 1, time: '08:30', day: '2026-07-06' });
    expect(lisbonSlot(new Date('2026-12-06T23:59:00Z'))).toEqual({ weekday: 0, time: '23:30', day: '2026-12-06' });
  });

  it('arredonda à meia hora para baixo', () => {
    expect(lisbonSlot(new Date('2026-12-07T09:14:00Z')).time).toBe('09:00');
  });
});
