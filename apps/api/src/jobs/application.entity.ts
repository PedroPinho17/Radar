import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn, type Relation } from 'typeorm';
import { User } from '../auth/user.entity.js';
import { Job } from './job.entity.js';
import { ApplicationEvent } from './application-event.entity.js';

/** Estados possíveis de uma candidatura (pipeline do utilizador). */
export const APPLICATION_STATUS = ['applied', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUS)[number];

/**
 * Candidatura do utilizador a uma oferta.
 * Uma por par (user, job). O histórico de mudanças fica em {@link ApplicationEvent}.
 */
@Entity('applications')
@Index(['userId', 'jobId'], { unique: true })
export class Application {
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
  @JoinColumn({ name: 'jobId' })
  job!: Relation<Job>;

  /** Estado actual (último passo do pipeline). */
  @Column({ type: 'varchar', default: 'applied' })
  status!: ApplicationStatus;

  /** Linha do tempo: cada mudança de estado (com nota opcional). */
  @OneToMany(() => ApplicationEvent, (e) => e.application, { cascade: true })
  events!: Relation<ApplicationEvent[]>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** Actualizado em cada mudança de estado — usado para marcar candidaturas “paradas”. */
  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
