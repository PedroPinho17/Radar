# Radar — API

NestJS + TypeORM (Postgres). Ver o [README do projeto](../../README.md) e o [COMO-CORRER.TXT](../../COMO-CORRER.TXT).

| Pasta | O quê |
|---|---|
| `src/auth` | registo, login, sessões, confirmação de email, recuperar password, apagar conta |
| `src/profile` | perfil a partir do CV (IA), preferências, áreas profissionais, GitHub |
| `src/jobs` | fontes de ofertas, filtros, avaliação pela IA, resumos por email, candidaturas |
| `src/account` | exportar dados (RGPD), primeiros passos, saúde, “reportar um problema”, limpeza diária |
| `src/mail` | envio de emails, templates, monitorização e alertas |
| `src/common` | rate limit, locks no Postgres, admins |
| `src/migrations` | migrações da base de dados (o esquema só muda por aqui) |

Variáveis de ambiente: ver `.env.example`.
