FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api build
RUN pnpm --filter api deploy --prod --legacy /out

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
COPY --from=build /out /app
EXPOSE 3001
CMD ["node", "dist/main"]
