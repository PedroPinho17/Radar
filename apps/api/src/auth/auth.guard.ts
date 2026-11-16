import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { IS_PUBLIC, type AuthedRequest } from './auth.decorators.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = this.auth.readToken(req);
    const session = token ? await this.auth.validate(token) : null;
    if (!session) {
      // cookie velho/inválido: apaga-o, para o site não ficar preso entre /login e /
      if (this.auth.hasCookie(req)) this.auth.clearCookie(ctx.switchToHttp().getResponse<Response>());
      throw new UnauthorizedException('Sessão inválida ou expirada. Faz login.');
    }

    req.user = session.user;
    req.sessionTokenHash = session.tokenHash;
    return true;
  }
}