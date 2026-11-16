import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, type Relation } from 'typeorm';
import { Application, type ApplicationStatus } from './application.entity.js';

/**
 * Um passo no histórico de uma candidatura (ex.: passou a “entrevista”).
 * Não apaga o estado anterior — a {@link Application} guarda só o estado actual.
 */
@Entity('application_events')
export class ApplicationEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Application, (a) => a.events, { onDelete: 'CASCADE' })
  application!: Relation<Application>;

  /** Estado para o qual a candidatura passou neste momento. */
  @Column({ type: 'varchar' })
  status!: ApplicationStatus;

  /** Nota livre do utilizador (ex.: "entrevista técnica dia 20 às 10h"). */
  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
