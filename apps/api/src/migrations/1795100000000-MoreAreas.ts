import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Áreas novas (Indústria/Produção, Engenharia, Recursos Humanos, Marketing/Comunicação…).
 * Quem veio do "sector" antigo tinha ficado numa área aproximada; passa para a certa,
 * MAS só se as áreas ainda forem exatamente as que a migração anterior pôs (a pessoa não mexeu).
 */
const REMAP: [sector: string, before: string, after: string][] = [
  ['Indústria e Produção', 'Outra', 'Indústria/Produção'],
  ['Marketing e Comunicação', 'Outra', 'Marketing/Comunicação'],
  ['Engenharia', 'Construção', 'Engenharia'],
  ['Recursos Humanos', 'Administrativo', 'Recursos Humanos'],
];

export class MoreAreas1795100000000 implements MigrationInterface {
  name = 'MoreAreas1795100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [sector, before, after] of REMAP) {
      await queryRunner.query(
        `UPDATE "preferences" SET "areas" = ARRAY[$3]::text[] WHERE "sector" = $1 AND "areas" = ARRAY[$2]::text[]`,
        [sector, before, after],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [sector, before, after] of REMAP) {
      await queryRunner.query(
        `UPDATE "preferences" SET "areas" = ARRAY[$2]::text[] WHERE "sector" = $1 AND "areas" = ARRAY[$3]::text[]`,
        [sector, before, after],
      );
    }
  }
}
