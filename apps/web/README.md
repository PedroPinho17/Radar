# Radar — site

Next.js (App Router) + Tailwind + shadcn/ui. Ver o [README do projeto](../../README.md) e o [COMO-CORRER.TXT](../../COMO-CORRER.TXT).

- `app/` — páginas (`/bem-vindo`, `/login`, `/`, `/candidaturas`, `/perfil`, `/estado`, `/termos`, `/privacidade`…)
- `components/` — componentes (formulário de preferências, cartões, diálogos, `ui/` do shadcn)
- `lib/` — lógica partilhada (chamadas à API, opções e pesquisa tolerante a gralhas, URLs seguros)
- `e2e/` — testes de ponta a ponta (Playwright)
- `proxy.ts` — encaminha quem não tem sessão (apresentação / login)

O site fala com a API por `/api/*` (reescrito para `API_URL`, por omissão `http://127.0.0.1:3001`).
