import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1794821782416 implements MigrationInterface {
    name = 'Init1794821782416'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // uuid_generate_v4() vem desta extensão (o synchronize criava-a sozinho; as migrações não)
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "emailVerifiedAt" TIMESTAMP WITH TIME ZONE, "termsAcceptedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "email_verifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tokenHash" character varying NOT NULL, "userId" uuid NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c1ea2921e767f83cd44c0af203f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ce0a8d27a7e9e49d49865e3e1a" ON "email_verifications"  ("tokenHash") `);
        await queryRunner.query(`CREATE TABLE "password_resets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tokenHash" character varying NOT NULL, "userId" uuid NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4816377aa98211c1de34469e742" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7f6aae0fcc807c9e7194ca5cc4" ON "password_resets"  ("tokenHash") `);
        await queryRunner.query(`CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tokenHash" character varying NOT NULL, "userId" uuid NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_bace6c68efc156fddac9b14bda" ON "sessions"  ("tokenHash") `);
        await queryRunner.query(`CREATE TABLE "jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "source" character varying NOT NULL, "externalId" character varying NOT NULL, "title" character varying NOT NULL, "company" character varying NOT NULL, "location" character varying, "workModel" character varying, "description" text NOT NULL, "url" character varying NOT NULL, "salaryMin" integer, "salaryMax" integer, "publishedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cf0a6c42b72fcc7f7c237def345" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4278e9ac6ba205b31425366260" ON "jobs"  ("source", "externalId") `);
        await queryRunner.query(`CREATE TABLE "applications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "jobId" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'applied', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_938c0a27255637bde919591888f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a2722f28b8d617c3696c8c125b" ON "applications"  ("userId", "jobId") `);
        await queryRunner.query(`CREATE TABLE "application_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" character varying NOT NULL, "note" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "applicationId" uuid, CONSTRAINT "PK_fd185969787381d8bf8c529bc00" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "matches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "jobId" uuid NOT NULL, "score" integer NOT NULL, "reasons" text array NOT NULL, "missingSkills" text array NOT NULL, "englishRequired" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "decision" character varying, "decisionReason" text, "decidedAt" TIMESTAMP WITH TIME ZONE, "minYears" integer, "coverLetter" text, "coverLetterAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_8a22c7b2e0828988d51256117f4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_98ec82a9dd0fd9a589350655c9" ON "matches"  ("userId", "jobId") `);
        await queryRunner.query(`CREATE TABLE "preferences" ("userId" uuid NOT NULL, "currentSalary" integer, "targetSalaryMin" integer, "targetSalaryMax" integer, "sector" character varying, "roles" text array NOT NULL DEFAULT '{}', "avoid" text array NOT NULL DEFAULT '{}', "excludeKeywords" text array NOT NULL DEFAULT '{}', "onsiteLocations" text array NOT NULL DEFAULT '{}', "hybridLocations" text array NOT NULL DEFAULT '{}', "remoteAnywhere" boolean NOT NULL DEFAULT true, "maxYears" integer NOT NULL DEFAULT '3', "notes" text, "githubUsername" character varying, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "dailyEmail" boolean NOT NULL DEFAULT true, "digestMinScore" integer NOT NULL DEFAULT '60', "emailDays" integer array NOT NULL DEFAULT '{1,2,3,4,5,6,0}', "emailTimes" text array NOT NULL DEFAULT '{08:30}', "emailMaxJobs" integer NOT NULL DEFAULT '10', "lastDigestAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_eb2de5fbaa61832e982f53d9716" PRIMARY KEY ("userId"))`);
        await queryRunner.query(`CREATE TABLE "profiles" ("userId" uuid NOT NULL, "title" character varying NOT NULL, "yearsExperience" integer NOT NULL, "seniority" character varying NOT NULL, "skills" text array NOT NULL, "languages" text array NOT NULL, "location" character varying, "summary" text NOT NULL, "sector" character varying, "suggestedRoles" text array NOT NULL DEFAULT '{}', "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_315ecd98bd1a42dcf2ec4e2e985" PRIMARY KEY ("userId"))`);
        await queryRunner.query(`ALTER TABLE "email_verifications" ADD CONSTRAINT "FK_4e63a91e0a684b31496bd50733e" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "password_resets" ADD CONSTRAINT "FK_d95569f623f28a0bf034a55099e" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sessions" ADD CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "applications" ADD CONSTRAINT "FK_90ad8bec24861de0180f638b9cc" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "applications" ADD CONSTRAINT "FK_f6ebb8bc5061068e4dd97df3c77" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "application_events" ADD CONSTRAINT "FK_f3db5d0c3088d18f39d95bfec78" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matches" ADD CONSTRAINT "FK_0e1f5006d52bcbc4936d2f18ace" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matches" ADD CONSTRAINT "FK_c78636ff8f8f666c6dc04155c57" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "preferences" ADD CONSTRAINT "FK_eb2de5fbaa61832e982f53d9716" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "profiles" ADD CONSTRAINT "FK_315ecd98bd1a42dcf2ec4e2e985" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "profiles" DROP CONSTRAINT "FK_315ecd98bd1a42dcf2ec4e2e985"`);
        await queryRunner.query(`ALTER TABLE "preferences" DROP CONSTRAINT "FK_eb2de5fbaa61832e982f53d9716"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_c78636ff8f8f666c6dc04155c57"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_0e1f5006d52bcbc4936d2f18ace"`);
        await queryRunner.query(`ALTER TABLE "application_events" DROP CONSTRAINT "FK_f3db5d0c3088d18f39d95bfec78"`);
        await queryRunner.query(`ALTER TABLE "applications" DROP CONSTRAINT "FK_f6ebb8bc5061068e4dd97df3c77"`);
        await queryRunner.query(`ALTER TABLE "applications" DROP CONSTRAINT "FK_90ad8bec24861de0180f638b9cc"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6"`);
        await queryRunner.query(`ALTER TABLE "password_resets" DROP CONSTRAINT "FK_d95569f623f28a0bf034a55099e"`);
        await queryRunner.query(`ALTER TABLE "email_verifications" DROP CONSTRAINT "FK_4e63a91e0a684b31496bd50733e"`);
        await queryRunner.query(`DROP TABLE "profiles"`);
        await queryRunner.query(`DROP TABLE "preferences"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_98ec82a9dd0fd9a589350655c9"`);
        await queryRunner.query(`DROP TABLE "matches"`);
        await queryRunner.query(`DROP TABLE "application_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a2722f28b8d617c3696c8c125b"`);
        await queryRunner.query(`DROP TABLE "applications"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4278e9ac6ba205b31425366260"`);
        await queryRunner.query(`DROP TABLE "jobs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bace6c68efc156fddac9b14bda"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7f6aae0fcc807c9e7194ca5cc4"`);
        await queryRunner.query(`DROP TABLE "password_resets"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ce0a8d27a7e9e49d49865e3e1a"`);
        await queryRunner.query(`DROP TABLE "email_verifications"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
