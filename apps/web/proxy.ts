import { NextResponse, type NextRequest } from 'next/server';

/** Páginas abertas a quem não tem sessão. */
const PUBLIC = ['/login', '/recuperar-password', '/redefinir-password', '/confirmar-email', '/privacidade', '/termos', '/bem-vindo'];

export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has('sid') || req.cookies.has('__Host-sid');
  const isPublic = PUBLIC.includes(req.nextUrl.pathname);
  // sem sessão: a página inicial mostra a apresentação do Radar; o resto pede login
  if (!hasSession && req.nextUrl.pathname === '/') return NextResponse.redirect(new URL('/bem-vindo', req.url));
  if (!hasSession && !isPublic) return NextResponse.redirect(new URL('/login', req.url));
  // já com sessão, o login não faz sentido: vai direto às ofertas
  if (hasSession && req.nextUrl.pathname === '/login') return NextResponse.redirect(new URL('/', req.url));
  return NextResponse.next();
}

// só páginas: fica de fora a API, os ficheiros do Next e qualquer ficheiro com extensão
// (robots.txt, imagens de public/…), que têm de abrir mesmo sem sessão
export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };
