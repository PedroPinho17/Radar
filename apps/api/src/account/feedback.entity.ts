import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../auth/user.entity.js';

export const FEEDBACK_TYPES = ['bug', 'oferta', 'sugestao', 'outro'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/** Problemas e sugestões enviados pelos utilizadores ("Reportar um problema"). */
@Entity('feedback')
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('uuid')
  userId!: string;

  // RGPD: apagar a conta apaga também o que a pessoa reportou
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  @Column({ type: 'varchar' })
  type!: FeedbackType;

  @Column('text')
  message!: string;

  /** Página onde a pessoa estava (ex.: "/perfil"). */
  @Column({ type: 'varchar', nullable: true })
  page!: string | null;

  /** Oferta avaliada a que se refere ("a nota está errada"). */
  @Column({ type: 'uuid', nullable: true })
  matchId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
