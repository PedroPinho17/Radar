FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
ARG API_URL=http://api:3001
ENV API_URL=$API_URL
# email de contacto mostrado em /privacidade (fica no build: variáveis NEXT_PUBLIC_* são públicas)
ARG NEXT_PUBLIC_CONTACT_EMAIL=
ENV NEXT_PUBLIC_CONTACT_EMAIL=$NEXT_PUBLIC_CONTACT_EMAIL
RUN pnpm --filter web build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
# o modo standalone não inclui a pasta public (robots.txt, imagens…): copia-se à parte
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
