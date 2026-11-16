import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Origens que podem fazer pedidos que alteram dados (POST/PUT/DELETE). */
function allowedOrigins() {
  const origins = new Set<string>();
  const add = (url?: string) => {
    try {
      if (url) origins.add(new URL(url).origin);
    } catch {
      /* URL inválido no .env: ignora */
    }
  };
  add(process.env.WEB_URL ?? 'http://localhost:3000');
  (process.env.ALLOWED_ORIGINS ?? '').split(',').forEach((o) => add(o.trim()));
  if (process.env.NODE_ENV !== 'production') {
    add('http://localhost:3000');
    add('http://127.0.0.1:3000');
  }
  return origins;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // o Next faz de proxy (localhost): confia no X-Forwarded-For só vindo daí, para o rate limit ver o IP real
  app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback');
  app.disable('x-powered-by');

  const origins = allowedOrigins();
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store'); // respostas com dados pessoais: nada em cache

    // defesa extra contra CSRF (além do cookie SameSite=Lax): recusa POSTs vindos de outros sites
    const origin = req.headers.origin;
    if (!SAFE_METHODS.has(req.method) && origin && !origins.has(origin)) {
      res.status(403).json({ statusCode: 403, message: 'Pedido recusado: origem não permitida.' });
      return;
    }
    next();
  });

  // só aceita ligações locais por omissão; num servidor com a API noutra máquina usa HOST=0.0.0.0
  await app.listen(process.env.PORT ?? 3001, process.env.HOST ?? '127.0.0.1');
}
await bootstrap();
