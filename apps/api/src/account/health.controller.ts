import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { CurrentUser, Public, type UserDto } from '../auth/auth.decorators.js';
import { isAdmin } from '../common/admin.js';
import { MINUTE, RateLimit } from '../common/rate-limit.js';
import { MonitorService } from '../mail/monitor.service.js';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly monitor: MonitorService,
  ) {}

  /** A base de dados responde em menos de 3 s? */
  private async database(): Promise<'ok' | 'down'> {
    try {
      await Promise.race([
        this.db.query('SELECT 1'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]);
      return 'ok';
    } catch {
      return 'down';
    }
  }

  /**
   * Público e mínimo, para um monitor externo (UptimeRobot, Better Stack…):
   * 200 = a funcionar (status "ok" ou "degraded"), 503 = em baixo.
   */
  @Public()
  @Get()
  @RateLimit({ limit: 60, windowMs: MINUTE })
  async health(@Res({ passthrough: true }) res: Response) {
    const database = await this.database();
    if (database === 'down') res.status(503);
    return { status: database === 'down' ? 'down' : this.monitor.status(), database, time: new Date().toISOString() };
  }

  /** Detalhe de cada peça. Só para quem está em ADMIN_EMAILS (os outros recebem 404). */
  @Get('details')
  async details(@CurrentUser() user: UserDto) {
    if (!isAdmin(user.email)) throw new NotFoundException();
    return { ...this.monitor.snapshot(), database: await this.database(), uptimeSeconds: Math.round(process.uptime()) };
  }
}
