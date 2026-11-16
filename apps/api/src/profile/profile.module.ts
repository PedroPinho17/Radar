import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileController } from './profile.controller.js';
import { Profile } from './profile.entity.js';
import { ProfileService } from './profile.service.js';
import { GithubService } from './github.service.js';
import { Preferences } from './preferences.entity.js';
import { PreferencesService } from './preferences.service.js';
import { PreferencesController } from './preferences.controller.js';


@Module({
  imports: [TypeOrmModule.forFeature([Profile, Preferences])],
  exports: [ProfileService, PreferencesService],
  providers: [ProfileService, GithubService, PreferencesService],
  controllers: [ProfileController, PreferencesController],
})
export class ProfileModule {}