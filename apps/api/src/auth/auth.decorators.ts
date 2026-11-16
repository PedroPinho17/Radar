import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Dados públicos do utilizador autenticado (sem password). */
export type UserDto = { id: string; email: string; emailVerified: boolean };

/** Request Express com campos de sessão preenchidos pelo guard de auth. */
export type AuthedRequest = Request & { user?: UserDto; sessionTokenHash?: string };

/** Chave de metadata usada pelo guard para detetar rotas públicas. */
export const IS_PUBLIC = 'isPublic';

/** Marca uma rota como acessível sem login. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Injeta o utilizador da sessão atual no parâmetro do controller. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): UserDto => {
  const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
  if (!user) throw new Error('@CurrentUser() usado numa rota @Public()');
  return user;
});
