# Radar

🇵🇹 Português · [🇬🇧 English](README.en.md)

Assistente de procura de emprego para **qualquer profissão**, da auxiliar de limpeza ao diretor financeiro.
A pessoa cria o perfil uma vez (com CV ou com um formulário simples, sem CV); o Radar junta ofertas de vários
sites de emprego, a IA dá a cada uma uma nota (0–100) face ao perfil e às preferências, e envia as melhores por
email nos dias e horas que a pessoa escolher.

> Como pôr a correr, testar e fazer deploy: **[COMO-CORRER.TXT](COMO-CORRER.TXT)**.

## Começar

Requisitos: Node.js 24+, pnpm 11 e Docker Desktop.

```bash
git clone https://github.com/PedroPinho17/radar.git
cd radar
pnpm install
cp apps/api/.env.example apps/api/.env   # preencher as chaves (Gemini, Groq, SMTP…)
docker compose up -d                     # liga o Postgres (porta 5434)
pnpm dev                                 # API em :3001 + site em :3000
```

Abrir <http://localhost:3000>. Para correr tudo em Docker: `docker compose --profile app up -d --build`.

## Funcionalidades

- **Perfil a partir do CV** (PDF, + LinkedIn opcional) **ou de um formulário sem CV**: experiência, escolaridade,
  carta de condução, área, distrito/cidade, turnos e tipo de contrato.
- **19 áreas profissionais**: do trabalho operacional (limpeza, restauração, indústria, logística, agricultura…)
  aos cargos qualificados e de direção (finanças, engenharia, direito, gestão…), cada uma ligada às categorias
  reais dos sites de emprego.
- **Ofertas filtradas** por funções, localização (308 concelhos ↔ distritos: o distrito "Aveiro" apanha Ovar,
  "Porto" não apanha "Porto de Mós"), experiência e palavras a evitar.
- **Nota da IA** com razões, requisitos em falta (carta, certificados, competências), horário e contrato;
  aprende com os "gosto / não gosto" e penaliza ofertas acima ou muito abaixo do nível da pessoa.
- **Salário estimado** nas ofertas de Informática que não dizem o salário (ver abaixo).
- **Filtro por fonte** na lista de ofertas (Net-Empregos, ITJobs, Jooble…).
- **Emails agendados**: dias da semana, até 6 horas por dia, nº de ofertas e nota mínima.
- **Cartas de apresentação** (PT/EN) em linguagem simples e **acompanhamento de candidaturas** com lembretes de follow-up.
- **Conta**: confirmação de email, recuperar/mudar password, terminar outras sessões.
- **RGPD**: consentimento, exportar dados (JSON), apagar conta, limpeza automática, páginas de Termos e Privacidade.
- **Operação**: `/api/health`, alertas por email, página `/estado` para admins, "Reportar um problema".

## Estrutura

```
apps/
  api/   NestJS + TypeORM (Postgres) — auth, perfil, ofertas, IA (Gemini/Groq), emails, tarefas agendadas
  web/   Next.js (App Router) + Tailwind + shadcn/ui — o site
packages/
  eslint-config/       configuração partilhada do ESLint
  typescript-config/   tsconfig partilhados
```

## Base de dados

PostgreSQL 16 (via `docker-compose.yml`), acedido pela API com TypeORM.

- **Migrações** em [`apps/api/src/migrations`](apps/api/src/migrations): a API aplica as pendentes ao arrancar,
  por isso uma base de dados vazia fica pronta sozinha.
- **Esquema completo** (só estrutura, sem dados) em [`apps/api/db/schema.sql`](apps/api/db/schema.sql), para consulta.
- Tabelas: `users`, `sessions`, `email_verifications`, `password_resets`, `profiles`, `preferences`, `jobs`,
  `matches`, `applications`, `application_events`, `feedback`, `migrations`.
- Comandos: `pnpm --filter api db:show | db:migrate | db:revert | db:generate src/migrations/Nome`.
- Backups (`pg_dump`) ficam em `base-de-dados/`, que está fora do git por conterem dados pessoais.
  Ver [COMO-CORRER.TXT](COMO-CORRER.TXT), secção 9.

## Fontes de ofertas

| Fonte | Para quem | Notas |
|---|---|---|
| ITJobs, Landing.jobs, We Work Remotely | Informática | APIs/RSS públicos (ITJobs pede chave) |
| Net-Empregos | todas as áreas | categorias das áreas de cada pessoa **no distrito dela**; pode bloquear pedidos automáticos |
| Jooble | todas as áreas | opcional (`JOOBLE_API_KEY`); pesquisa na zona de cada pessoa |

A IA avalia as ofertas alternando entre fontes, para nenhuma fonte "abafar" as outras.

## Salário estimado (serviço externo, opcional)

Muitas ofertas não dizem o salário. Para essas, o Radar pode mostrar uma estimativa
(**"≈ 24 000 €/ano (estimado)"**) pedida a um **serviço à parte, de outro projeto**: o *salary-predictor*,
uma pequena API em Python com um modelo treinado com salários de Informática em Portugal.

- **Localmente** corre noutro terminal, na porta `8000`, e o Radar liga-se a ele por `SALARY_API_URL`:
  - `pnpm dev`: `SALARY_API_URL=http://127.0.0.1:8000` em `apps/api/.env`;
  - Docker: `SALARY_API_URL=http://host.docker.internal:8000` (já no `docker-compose.yml`).
- **É opcional**: sem `SALARY_API_URL`, ou com o serviço desligado, o Radar funciona igual, só não mostra estimativas.
  Se o serviço falhar, o Radar não insiste durante 1 minuto.
- **Só para Informática** (é o que o modelo conhece) e **só no site**: os emails não pedem estimativas.
- Contrato esperado pelo Radar:

  ```http
  POST /estimate
  { "title": "Backend Developer", "years": 1, "skills": ["Python", "JavaScript", "SQL"] }

  200 { "salario_anual_eur": 24000 }
  ```

  Respostas fora do plausível (menos de 5 000 € ou mais de 500 000 €) são ignoradas. As estimativas ficam em
  cache, pedidos iguais juntam-se e há no máximo 4 pedidos em simultâneo.

## Qualidade

- `pnpm test` — testes unitários (API e site). Cobertura mínima obrigatória: 80% linhas/instruções/funções, 70% ramos.
- `pnpm test:e2e` — testes de ponta a ponta no Chrome (registo → perfil → preferências → apagar conta), em base de dados à parte.
- `pnpm lint` — ESLint (site) e oxlint (API).

## Segurança (resumo)

Passwords com scrypt; sessões em cookie httpOnly (só o hash na BD); rate limits e bloqueio após falhas de login;
verificação de `Origin`; cabeçalhos de segurança (CSP, HSTS em produção…); tokens de email no fragmento do URL
(nunca enviados a servidores) e de uso único; locks no Postgres para tarefas agendadas com várias instâncias.
