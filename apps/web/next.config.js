import path from 'node:path';

const isDev = process.env.NODE_ENV !== 'production';

// Política de conteúdo: só carrega scripts/estilos/imagens do próprio site.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  poweredByHeader: false,
  // os testes de ponta a ponta usam um build à parte (.next-e2e), para não estragar o de desenvolvimento
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    proxyTimeout: 60_000, // o CV pode demorar (2 modelos x 20s)
  },
  // /api/jobs -> http://127.0.0.1:3001/jobs (mesmo domínio, o cookie de sessão passa)
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.API_URL ?? 'http://127.0.0.1:3001'}/:path*` }];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // a página de redefinir password tem o token no URL: nunca o passar a ninguém
      { source: '/redefinir-password', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
      { source: '/confirmar-email', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
    ];
  },
};

export default nextConfig;
