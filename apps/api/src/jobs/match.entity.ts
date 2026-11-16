import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { User } from '../auth/user.entity.js';
import { Job } from './job.entity.js';

/**
 * Resultado da avaliação da IA: uma oferta × um utilizador.
 * Cada par (user, job) é avaliado no máximo uma vez.
 */
@Entity('matches')
@Index(['userId', 'jobId'], { unique: true })
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  @Column('uuid')
  jobId!: string;

  @ManyToOne(() => Job, { onDelete: 'CASCADE' })
  job!: Relation<Job>;

  /** Nota 0–100 dada pela IA (quanto a oferta encaixa no perfil). */
  @Column('int')
  score!: number;

  /** Motivos curtos em português (positivos e negativos). */
  @Column('text', { array: true })
  reasons!: string[];

  /**
   * Requisitos da oferta que a pessoa não tem (carta, certificado, inglês…).
   * Em IT pode incluir tecnologias; nas outras áreas, requisitos reais do anúncio.
   */
  @Column('text', { array: true })
  missingSkills!: string[];

  @Column({ default: false })
  englishRequired!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** Reacção do utilizador: gosto / não gosto / candidatei-me. */
  @Column({ type: 'varchar', nullable: true })
  decision!: 'like' | 'dislike' | 'applied' | null;

  @Column({ type: 'text', nullable: true })
  decisionReason!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;

  /** Anos mínimos pedidos no anúncio (`null` se não disser). */
  @Column({ type: 'int', nullable: true })
  minYears!: number | null;

  /** Horário extraído pela IA (ex. "manhã", "turnos", "9h-18h"). */
  @Column({ type: 'varchar', nullable: true })
  schedule!: string | null;

  /** Tipo de contrato extraído pela IA (ex. "termo certo", "recibo verde"). */
  @Column({ type: 'varchar', nullable: true })
  contractType!: string | null;

  /** Carta de apresentação gerada (opcional). */
  @Column({ type: 'text', nullable: true }) coverLetter!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) coverLetterAt!: Date | null;
}
