import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../auth/user.entity.js';

/**
 * Resumo profissional da pessoa (extraído do CV ou preenchido no formulário).
 * O PDF do CV **não** é guardado — só este resumo.
 */
@Entity('profiles')
export class Profile {
  @PrimaryColumn('uuid')
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  /** Função actual ou alvo (ex. "Auxiliar de Ação Educativa"). */
  @Column()
  title!: string;

  /** Anos de experiência profissional paga (sem estágios/voluntariado, se veio do CV). */
  @Column({ type: 'int' })
  yearsExperience!: number;

  /** `junior` | `mid` | `senior` — derivado dos anos ou da IA. */
  @Column()
  seniority!: string;

  /** Competências / certificados / tecnologias relevantes para anúncios. */
  @Column('text', { array: true })
  skills!: string[];

  /** Línguas faladas (em inglês no nome, ex. "Portuguese"). */
  @Column('text', { array: true })
  languages!: string[];

  @Column({ nullable: true, type: 'varchar' })
  location!: string | null;

  /** Apresentação curta em 1.ª pessoa (pt-PT). */
  @Column('text')
  summary!: string;

  /** Área principal (legado / detetada no CV). Preferências usam `areas[]`. */
  @Column({ type: 'varchar', nullable: true })
  sector!: string | null;

  /** Títulos de emprego sugeridos pela IA a partir do CV. */
  @Column('text', { array: true, default: '{}' })
  suggestedRoles!: string[];

  /** Escolaridade (formulário sem CV). */
  @Column({ type: 'varchar', nullable: true })
  education!: string | null;

  /** Carta de condução: ex. `"B"`, `"sem"`, ou `null`. */
  @Column({ type: 'varchar', nullable: true })
  drivingLicense!: string | null;

  /** Como o perfil foi criado: PDF (`cv`) ou formulário (`form`). */
  @Column({ type: 'varchar', default: 'cv' })
  source!: 'cv' | 'form';

  @UpdateDateColumn()
  updatedAt!: Date;
}
