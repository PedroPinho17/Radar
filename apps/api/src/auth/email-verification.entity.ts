import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from './user.entity.js';

/** Link de confirmação de email. Só guardamos o hash do token; uso único. */
@Entity('email_verifications')
export class EmailVerification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  tokenHash!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  user!: Relation<User>;

  @Column()
  userId!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
