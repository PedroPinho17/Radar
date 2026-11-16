import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { Application, APPLICATION_STATUS } from './application.entity.js';
import { ApplicationEvent } from './application-event.entity.js';
import { Job } from './job.entity.js';
import { Match } from './match.entity.js';

const applySchema = z.object({ jobId: z.uuid(), note: z.string().trim().max(500).optional() });
const statusSchema = z.object({ status: z.enum(APPLICATION_STATUS), note: z.string().trim().max(500).optional() });

/** Dias sem atualização para uma candidatura aberta contar como “parada” (follow-up). */
const STALE_DAYS = 14;
/** Estados ainda em curso (não finais). */
const OPEN = ['applied', 'interview', 'offer'];

/**
 * Gestão de candidaturas: registar, avançar estado e listar (com flag `stale`).
 * Ao candidatar-se, marca também o {@link Match} como `applied` para a IA aprender.
 */
@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application) private readonly apps: Repository<Application>,
    @InjectRepository(ApplicationEvent) private readonly events: Repository<ApplicationEvent>,
    @InjectRepository(Job) private readonly jobs: Repository<Job>,
    @InjectRepository(Match) private readonly matches: Repository<Match>,
  ) {}

  /**
   * Regista que o utilizador se candidatou a uma oferta.
   * @throws NotFoundException se a oferta não existir
   * @throws ConflictException se já houver candidatura a essa oferta
   */
  async apply(userId: string, body: unknown) {
    const parsed = applySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Indica o jobId da oferta');
    const { jobId, note } = parsed.data;

    if (!(await this.jobs.existsBy({ id: jobId }))) throw new NotFoundException('Oferta não encontrada');
    if (await this.apps.existsBy({ userId, jobId })) throw new ConflictException('Já te candidataste a esta oferta');

    const app = await this.apps.save(
      this.apps.create({ userId, jobId, status: 'applied', events: [{ status: 'applied', note: note ?? null }] }),
    );
    // a IA também aprende com isto (histórico de decisões)
    await this.matches.update({ userId, jobId }, { decision: 'applied', decidedAt: new Date() });
    return app;
  }

  /**
   * Avança a candidatura (entrevista, proposta, aceite, recusado…).
   * Cria um {@link ApplicationEvent} e actualiza `updatedAt`.
   */
  async updateStatus(userId: string, id: string, body: unknown) {
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(`Estado inválido: usa ${APPLICATION_STATUS.join(', ')}`);
    const { status, note } = parsed.data;

    const app = await this.apps.findOneBy({ id, userId });
    if (!app) throw new NotFoundException('Candidatura não encontrada');

    app.status = status;
    await this.apps.save(app);
    await this.events.save(this.events.create({ application: app, status, note: note ?? null }));
    return this.findOne(userId, id);
  }

  /**
   * Lista as candidaturas do utilizador, mais recentes primeiro.
   * Cada item inclui `stale: true` se estiver aberta e sem novidades há {@link STALE_DAYS} dias.
   */
  async list(userId: string) {
    const all = await this.apps.find({
      where: { userId },
      relations: { job: true, events: true },
      order: { updatedAt: 'DESC', events: { createdAt: 'ASC' } },
    });
    const limit = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
    return all.map((a) => Object.assign(a, { stale: OPEN.includes(a.status) && a.updatedAt.getTime() < limit }));
  }

  /** Uma candidatura com oferta e eventos (só da própria pessoa). */
  private findOne(userId: string, id: string) {
    return this.apps.findOne({
      where: { id, userId },
      relations: { job: true, events: true },
      order: { events: { createdAt: 'ASC' } },
    });
  }
}
