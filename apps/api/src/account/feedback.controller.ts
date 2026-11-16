import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser, type UserDto } from '../auth/auth.decorators.js';
import { isAdmin } from '../common/admin.js';
import { MINUTE, RateLimit } from '../common/rate-limit.js';
import { FeedbackService } from './feedback.service.js';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  /** "Reportar um problema". */
  @Post()
  @RateLimit({ limit: 5, windowMs: 60 * MINUTE, by: 'user' })
  create(@CurrentUser() user: UserDto, @Body() body: unknown) {
    return this.feedback.create(user, body);
  }

  /** Admins: lista o que foi reportado. */
  @Get()
  list(@CurrentUser() user: UserDto) {
    if (!isAdmin(user.email)) throw new NotFoundException();
    return this.feedback.list();
  }

  @Post(':id/resolve')
  resolve(@CurrentUser() user: UserDto, @Param('id', ParseUUIDPipe) id: string) {
    if (!isAdmin(user.email)) throw new NotFoundException();
    return this.feedback.resolve(id);
  }
}
