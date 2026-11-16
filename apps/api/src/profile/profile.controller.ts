import { BadRequestException, Body, Controller, Get, Post, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CurrentUser, type UserDto } from '../auth/auth.decorators.js';
import { ProfileService } from './profile.service.js';
import { GithubService } from './github.service.js';
import { PreferencesService } from './preferences.service.js';
import { MINUTE, RateLimit } from '../common/rate-limit.js';


const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

@Controller('profile')
export class ProfileController {
  constructor(
    private readonly profile: ProfileService,
    private readonly githubService: GithubService,
    private readonly preferences: PreferencesService,
  ) {}

  @Get()
  get(@CurrentUser() user: UserDto) {
    return this.profile.get(user.id);
  }

  @Post('form')
  @RateLimit({ limit: 20, windowMs: 10 * MINUTE, by: 'user' })
  saveForm(@CurrentUser() user: UserDto, @Body() body: unknown) {
    return this.profile.saveFromForm(user.id, body);
  }

  @Post('cv')
  @RateLimit({ limit: 5, windowMs: 10 * MINUTE, by: 'user' }) // cada envio chama a IA
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'cv', maxCount: 1 }, { name: 'linkedin', maxCount: 1 }], {
      limits: { fileSize: MAX_SIZE },
    }),
  )
  upload(
    @CurrentUser() user: UserDto,
    @UploadedFiles() files: { cv?: Express.Multer.File[]; linkedin?: Express.Multer.File[] } = {},
  ) {
    const cv = files.cv?.[0];
    const linkedin = files.linkedin?.[0];
    if (!cv) throw new BadRequestException('Envia o CV no campo "cv".');

    const isPdf = (f: Express.Multer.File) => f.buffer.subarray(0, 5).toString() === '%PDF-';
    if (!isPdf(cv)) throw new BadRequestException('O CV tem de ser um PDF.');
    if (linkedin && !isPdf(linkedin)) throw new BadRequestException('O LinkedIn tem de ser um PDF.');

    return this.profile.saveFromCv(user.id, cv.buffer, linkedin?.buffer);
  }

  @Get('github')
  @RateLimit({ limit: 10, windowMs: 10 * MINUTE, by: 'user' })
  async github(@CurrentUser() user: UserDto) {
    const { githubUsername } = await this.preferences.get(user.id);
    if (!githubUsername) throw new BadRequestException('Ainda não indicaste o teu GitHub nas preferências.');
    return this.githubService.repos(githubUsername);
  }
}