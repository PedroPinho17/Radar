import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Conta de utilizador (email + password hash). Sem perfil até enviar CV ou formulário. */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ select: false })
  passwordHash!: string;

  /** null = ainda não confirmou o email (não recebe resumos). */
  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  /** Quando aceitou a Política de Privacidade (RGPD: prova do consentimento). */
  @Column({ type: 'timestamptz', nullable: true })
  termsAcceptedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
