import { MigrationInterface, QueryRunner } from "typeorm";

export class Feedback1794823590417 implements MigrationInterface {
    name = 'Feedback1794823590417'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "feedback" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "type" character varying NOT NULL, "message" text NOT NULL, "page" character varying, "matchId" uuid, "resolvedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8389f9e087a57689cd5be8b2b13" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4a39e6ac0cecdf18307a365cf3" ON "feedback"  ("userId") `);
        await queryRunner.query(`ALTER TABLE "feedback" ADD CONSTRAINT "FK_4a39e6ac0cecdf18307a365cf3c" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "feedback" DROP CONSTRAINT "FK_4a39e6ac0cecdf18307a365cf3c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4a39e6ac0cecdf18307a365cf3"`);
        await queryRunner.query(`DROP TABLE "feedback"`);
    }

}
