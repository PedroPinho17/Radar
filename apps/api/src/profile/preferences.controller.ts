import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentUser, type UserDto } from '../auth/auth.decorators.js';
import { PreferencesService } from './preferences.service.js';
import { MINUTE, RateLimit } from '../common/rate-limit.js';

@Controller('preferences')
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  get(@CurrentUser() user: UserDto) {
    return this.preferences.get(user.id);
  }

  @Put()
  @RateLimit({ limit: 30, windowMs: MINUTE, by: 'user' })
  update(@CurrentUser() user: UserDto, @Body() body: unknown) {
    return this.preferences.update(user.id, body);
  }
}