import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from './user.entity.js';

/** Pedido de "esqueci-me da password". Só guardamos o hash do token; uso único. */
@Entity('password_resets')
export class PasswordReset {
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
