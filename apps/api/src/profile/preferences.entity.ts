import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import type { Area, ContractType, Shift, WorkTime } from './sectors.js';
import { User } from '../auth/user.entity.js';

/**
 * O que a pessoa procura: áreas, locais, turnos, salário e emails.
 * Usado para filtrar ofertas, planear o sync das fontes e no prompt da IA.
 */
@Entity('preferences')
export class Preferences {
  @PrimaryColumn('uuid')
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  /** Salários em € brutos por ano. */
  @Column({ type: 'int', nullable: true }) currentSalary!: number | null;
  @Column({ type: 'int', nullable: true }) targetSalaryMin!: number | null;
  @Column({ type: 'int', nullable: true }) targetSalaryMax!: number | null;

  /**
   * @deprecated Preferir `areas`. Mantido para contas antigas e migração.
   */
  @Column({ type: 'varchar', nullable: true }) sector!: string | null;

  /** Áreas profissionais canónicas (pode ser mais do que uma). */
  @Column('text', { array: true, default: '{}' }) areas!: Area[];
  /** Funções / títulos a procurar nos sites. */
  @Column('text', { array: true, default: '{}' }) roles!: string[];
  /** Coisas a evitar (a IA baixa a nota). */
  @Column('text', { array: true, default: '{}' }) avoid!: string[];
  /** Palavras no título que escondem a oferta antes da IA. */
  @Column('text', { array: true, default: '{}' }) excludeKeywords!: string[];

  @Column({ type: 'varchar', nullable: true }) district!: string | null;
  @Column({ type: 'varchar', nullable: true }) city!: string | null;
  /**
   * Distância máxima em km (informativo / UI).
   * O filtro real usa distrito/cidade e mapa de concelhos — não GPS.
   */
  @Column({ type: 'int', nullable: true }) maxDistanceKm!: number | null;
  @Column('text', { array: true, default: '{}' }) shifts!: Shift[];
  @Column('text', { array: true, default: '{}' }) contractTypes!: ContractType[];
  @Column({ type: 'varchar', nullable: true }) workTime!: WorkTime | null;

  /** Cidades onde aceita presencial, híbrido ou remoto. */
  @Column('text', { array: true, default: '{}' }) onsiteLocations!: string[];
  /** Cidades onde só aceita híbrido/remoto (não presencial todos os dias). */
  @Column('text', { array: true, default: '{}' }) hybridLocations!: string[];
  /** Aceita 100% remoto de qualquer sítio. */
  @Column({ default: true }) remoteAnywhere!: boolean;

  /** Esconde ofertas que pedem mais anos do que isto (combinado com os anos do perfil). */
  @Column({ type: 'int', default: 3 }) maxYears!: number;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ type: 'varchar', nullable: true }) githubUsername!: string | null;

  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;

  // ---- emails do resumo diário ----
  @Column({ default: true }) dailyEmail!: boolean;
  @Column({ type: 'int', default: 60 }) digestMinScore!: number;
  /** 0 = domingo … 6 = sábado. */
  @Column('int', { array: true, default: '{1,2,3,4,5,6,0}' }) emailDays!: number[];
  /** Horas de Lisboa, de 30 em 30 min (`HH:MM`). */
  @Column('text', { array: true, default: '{08:30}' }) emailTimes!: string[];
  @Column({ type: 'int', default: 10 }) emailMaxJobs!: number;
  /** Interno: último envio automático (para não repetir ofertas). */
  @Column({ type: 'timestamptz', nullable: true }) lastDigestAt!: Date | null;
}
