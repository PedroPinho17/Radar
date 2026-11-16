import { Body, Controller, Delete, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MINUTE, RateLimit } from '../common/rate-limit.js';
import { isAdmin } from '../common/admin.js';
import { AuthService } from './auth.service.js';
import { CurrentUser, Public, type AuthedRequest, type UserDto } from './auth.decorators.js';

const HOUR = 60 * MINUTE;

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @RateLimit({ limit: 5, windowMs: HOUR })
  async register(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    return this.auth.startSession(await this.auth.register(body), res);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @RateLimit({ limit: 20, windowMs: 15 * MINUTE })
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    return this.auth.startSession(await this.auth.login(body), res);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @RateLimit({ limit: 5, windowMs: HOUR })
  forgotPassword(@Body() body: unknown) {
    return this.auth.forgotPassword(body);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @RateLimit({ limit: 10, windowMs: 15 * MINUTE })
  async resetPassword(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    return this.auth.startSession(await this.auth.resetPassword(body), res);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(200)
  @RateLimit({ limit: 20, windowMs: 15 * MINUTE })
  verifyEmail(@Body() body: unknown) {
    return this.auth.verifyEmail(body);
  }

  @Post('resend-verification')
  @HttpCode(200)
  @RateLimit({ limit: 3, windowMs: HOUR, by: 'user' })
  resendVerification(@CurrentUser() user: UserDto) {
    return this.auth.resendVerification(user);
  }

  /** RGPD: apaga a conta e todos os dados. Pede a password no body. */
  @Delete('account')
  @HttpCode(204)
  @RateLimit({ limit: 5, windowMs: 15 * MINUTE, by: 'user' })
  async deleteAccount(@CurrentUser() user: UserDto, @Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    await this.auth.deleteAccount(user.id, body, res);
  }

  @Post('change-password')
  @HttpCode(200)
  @RateLimit({ limit: 5, windowMs: 15 * MINUTE, by: 'user' })
  changePassword(@CurrentUser() user: UserDto, @Req() req: AuthedRequest, @Body() body: unknown) {
    return this.auth.changePassword(user.id, req.sessionTokenHash, body);
  }

  @Post('logout-others')
  @HttpCode(200)
  logoutOthers(@CurrentUser() user: UserDto, @Req() req: AuthedRequest) {
    return this.auth.logoutOthers(user.id, req.sessionTokenHash);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    await this.auth.endSession(req.sessionTokenHash, res);
  }

  @Get('me')
  me(@CurrentUser() user: UserDto) {
    return { ...user, isAdmin: isAdmin(user.email) };
  }
}
