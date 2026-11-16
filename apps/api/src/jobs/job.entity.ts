import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Oferta de emprego guardada na base (vindo de ITJobs, Net-Empregos, Jooble, etc.).
 * A chave natural é (`source`, `externalId`) — a mesma oferta não entra duas vezes.
 */
@Entity('jobs')
@Index(['source', 'externalId'], { unique: true })
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Site de origem: `itjobs` | `landing` | `netempregos` | `wwr` | `jooble`. */
  @Column()
  source!: string;

  /** Id da oferta no site de origem (string). */
  @Column()
  externalId!: string;

  /**
   * Área Radar (ex. `Educação/Creche`).
   * Preenchida no sync; `null` em ofertas antigas ou quando a fonte não mapeia bem.
   */
  @Column({ type: 'varchar', nullable: true })
  area!: string | null;

  @Column()
  title!: string;

  @Column()
  company!: string;

  /** Zona/cidade como veio da fonte (texto livre). */
  @Column({ type: 'varchar', nullable: true })
  location!: string | null;

  /** Presencial / híbrido / remoto, se a fonte indicar; senão `null`. */
  @Column({ type: 'varchar', nullable: true })
  workModel!: 'onsite' | 'hybrid' | 'remote' | null;

  @Column({ type: 'text' })
  description!: string;

  /** URL pública da oferta no site de origem. */
  @Column()
  url!: string;

  /** Salário bruto anual (€), se conhecido. */
  @Column({ type: 'int', nullable: true })
  salaryMin!: number | null;

  @Column({ type: 'int', nullable: true })
  salaryMax!: number | null;

  /** Data de publicação no site (pode ser “refrescada” todos os dias em algumas fontes). */
  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  /** Quando a oferta entrou na nossa base. */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
