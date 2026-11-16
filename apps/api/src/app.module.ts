import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source.js';
import { AuthModule } from './auth/auth.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { ScheduleModule } from '@nestjs/schedule';
import { MailModule } from './mail/mail.module.js';
import { AccountModule } from './account/account.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...dataSourceOptions(config.getOrThrow<string>('DATABASE_URL')),
        entities: [], // a app regista as entidades pelos módulos
        autoLoadEntities: true,
        migrationsRun: true, // aplica as migrações pendentes ao arrancar (deploy sem passos manuais)
      }),
    }),
    MailModule,
    AuthModule,
    ProfileModule,
    JobsModule,
    AccountModule,
  ],
})
export class AppModule {}