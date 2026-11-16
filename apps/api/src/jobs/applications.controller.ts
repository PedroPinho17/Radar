import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser, type UserDto } from '../auth/auth.decorators.js';
import { ApplicationsService } from './applications.service.js';
import { MINUTE, RateLimit } from '../common/rate-limit.js';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  list(@CurrentUser() user: UserDto) {
    return this.applications.list(user.id);
  }

  @Post()
  @RateLimit({ limit: 30, windowMs: MINUTE, by: 'user' })
  apply(@CurrentUser() user: UserDto, @Body() body: unknown) {
    return this.applications.apply(user.id, body);
  }

  @Post(':id/status')
  @RateLimit({ limit: 30, windowMs: MINUTE, by: 'user' })
  updateStatus(@CurrentUser() user: UserDto, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.applications.updateStatus(user.id, id, body);
  }
}