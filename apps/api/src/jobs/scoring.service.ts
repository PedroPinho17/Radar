import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { withLock } from '../common/db-lock.js';
import { JobsService } from './jobs.service.js';
import { MatchService } from './match.service.js';

const HOUR = 60 * 60 * 1000;
/** Ofertas avaliadas por pessoa em cada ronda: poucas de cada vez, para repartir o custo pelo dia. */
export const PER_ROUND = 15;

/**
 * Avalia as ofertas novas em segundo plano, de meia em meia hora, em vez de tudo à hora do email.
 * Assim o envio das 8h30 é rápido, o custo da IA espalha-se pelo dia e ninguém espera.
 */
@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly jobs: JobsService,
    private readonly match: MatchService,
  ) {}

  // aos :15 e :45, entre os envios de emails (que são às :00 e :30)
  @Cron('15,45 * * * *', { timeZone: 'Europe/Lisbon' })
  async backgroundRound() {
    const r = await withLock(this.db, 'radar:scoring', () => this.round());
    if (!r.ran) this.logger.debug('Ronda saltada: outra instância já está a avaliar');
  }

  /**
   * Quem vale a pena avaliar: email confirmado E (emails ligados OU sessão ativa, i.e. entrou nos últimos 30 dias).
   * Contas paradas com os emails desligados não gastam quota de IA.
   */
  private async activePeople(): Promise<{ id: string }[]> {
    return this.db.query(
      `SELECT u.id FROM users u
         LEFT JOIN preferences p ON p."userId" = u.id
        WHERE u."emailVerifiedAt" IS NOT NULL
          AND (COALESCE(p."dailyEmail", true)
               OR EXISTS (SELECT 1 FROM sessions s WHERE s."userId" = u.id AND s."expiresAt" > now()))`,
    );
  }

  /** Uma ronda: ofertas frescas e depois um pouco de avaliação para cada pessoa ativa. */
  async round() {
    try {
      await this.jobs.syncIfStale(3 * HOUR);
    } catch (err) {
      this.logger.warn(`Sync em segundo plano falhou: ${(err as Error).message}`);
    }
    const people = await this.activePeople();
    let scored = 0;
    for (const { id } of people) {
      try {
        scored += (await this.match.matchPending(id, PER_ROUND)).scored;
      } catch (err) {
        // sem CV, ou a pessoa carregou em "Analisar novas" agora mesmo: fica para a próxima ronda
        if (err instanceof NotFoundException || err instanceof ConflictException) continue;
        this.logger.warn(`Avaliação em segundo plano falhou para ${id}: ${(err as Error).message}`);
      }
    }
    if (scored) this.logger.log(`Ronda em segundo plano: ${scored} ofertas avaliadas`);
    return { people: people.length, scored };
  }
}
