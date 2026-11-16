import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Multi-profissão: areas[], distrito/cidade/turnos, job.area, match.schedule/contractType,
 * perfil sem CV (education, drivingLicense, source).
 */
export class MultiProfession1795000000000 implements MigrationInterface {
  name = 'MultiProfession1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "preferences" ADD "areas" text array NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`ALTER TABLE "preferences" ADD "district" character varying`);
    await queryRunner.query(`ALTER TABLE "preferences" ADD "city" character varying`);
    await queryRunner.query(`ALTER TABLE "preferences" ADD "maxDistanceKm" integer`);
    await queryRunner.query(`ALTER TABLE "preferences" ADD "shifts" text array NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`ALTER TABLE "preferences" ADD "contractTypes" text array NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`ALTER TABLE "preferences" ADD "workTime" character varying`);

    // sector legado → areas (mapeamento canónico)
    await queryRunner.query(`
      UPDATE "preferences" SET "areas" = ARRAY[
        CASE "sector"
          WHEN 'Tecnologia' THEN 'Informática'
          WHEN 'Educação' THEN 'Educação/Creche'
          WHEN 'Saúde e Apoio Social' THEN 'Saúde/Cuidados'
          WHEN 'Restauração e Hotelaria' THEN 'Restauração/Hotelaria'
          WHEN 'Comércio e Vendas' THEN 'Comércio/Vendas'
          WHEN 'Administrativo e Finanças' THEN 'Administrativo'
          WHEN 'Indústria e Produção' THEN 'Outra'
          WHEN 'Construção' THEN 'Construção'
          WHEN 'Logística e Transportes' THEN 'Logística/Armazém'
          WHEN 'Limpeza e Serviços' THEN 'Limpeza'
          WHEN 'Apoio ao Cliente' THEN 'Administrativo'
          WHEN 'Marketing e Comunicação' THEN 'Outra'
          WHEN 'Engenharia' THEN 'Construção'
          WHEN 'Recursos Humanos' THEN 'Administrativo'
          WHEN 'Outra' THEN 'Outra'
          WHEN 'Informática' THEN 'Informática'
          ELSE COALESCE("sector", 'Informática')
        END
      ]
      WHERE "sector" IS NOT NULL AND (areas IS NULL OR cardinality(areas) = 0)
    `);
    // contas antigas sem sector (Radar começou em IT)
    await queryRunner.query(`
      UPDATE "preferences" SET "areas" = ARRAY['Informática']
      WHERE (areas IS NULL OR cardinality(areas) = 0)
        AND EXISTS (SELECT 1 FROM profiles p WHERE p."userId" = preferences."userId")
    `);

    await queryRunner.query(`ALTER TABLE "jobs" ADD "area" character varying`);
    await queryRunner.query(`ALTER TABLE "matches" ADD "schedule" character varying`);
    await queryRunner.query(`ALTER TABLE "matches" ADD "contractType" character varying`);

    await queryRunner.query(`ALTER TABLE "profiles" ADD "education" character varying`);
    await queryRunner.query(`ALTER TABLE "profiles" ADD "drivingLicense" character varying`);
    await queryRunner.query(`ALTER TABLE "profiles" ADD "source" character varying NOT NULL DEFAULT 'cv'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "source"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "drivingLicense"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "education"`);
    await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "contractType"`);
    await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "schedule"`);
    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "area"`);
    await queryRunner.query(`ALTER TABLE "preferences" DROP COLUMN "workTime"`);
    await queryRunner.query(`ALTER TABLE "preferences" DROP COLUMN "contractTypes"`);
    await queryRunner.query(`ALTER TABLE "preferences" DROP COLUMN "shifts"`);
    await queryRunner.query(`ALTER TABLE "preferences" DROP COLUMN "maxDistanceKm"`);
    await queryRunner.query(`ALTER TABLE "preferences" DROP COLUMN "city"`);
    await queryRunner.query(`ALTER TABLE "preferences" DROP COLUMN "district"`);
    await queryRunner.query(`ALTER TABLE "preferences" DROP COLUMN "areas"`);
  }
}
