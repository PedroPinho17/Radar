// jobs.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from './job.entity.js';
import { ItjobsService } from './itjobs.service.js';
import { LandingService } from './landing.service.js';
import { NetEmpregosService } from './netempregos.service.js';
import { WwrService } from './wwr.service.js';
import { JobsService } from './jobs.service.js';
import { JobsController } from './jobs.controller.js';
import { ProfileModule } from '../profile/profile.module.js';
import { MatchService } from './match.service.js';
import { Match } from './match.entity.js';
import { Application } from './application.entity.js';
import { ApplicationEvent } from './application-event.entity.js';
import { ApplicationsService } from './applications.service.js';
import { ApplicationsController } from './applications.controller.js';
import { DigestController } from './digest.controller.js';
import { DigestService } from './digest.service.js';
import { User } from '../auth/user.entity.js';
import { JoobleService } from './jooble.service.js';
import { ScoringService } from './scoring.service.js';
import { SalaryService } from './salary.service.js';


@Module({
  imports: [TypeOrmModule.forFeature([Job, Match, Application, ApplicationEvent, User]), ProfileModule],
  providers: [SalaryService, ScoringService, JoobleService, ItjobsService, LandingService, NetEmpregosService, WwrService, JobsService, MatchService, ApplicationsService, DigestService],
  controllers: [JobsController, ApplicationsController, DigestController],
})
export class JobsModule {}