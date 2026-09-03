# Build context: repo root (monorepo workspace)
# docker build -f apps/api/Dockerfile -t akyuam-api .

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @akyuam/shared build
RUN pnpm --filter @akyuam/api exec prisma generate
RUN pnpm --filter @akyuam/api build

# No hereda de "deps": ese stage ya instaló devDependencies, y reinstalar encima
# con --prod obliga a pnpm a podar node_modules, lo que pide confirmación
# interactiva y rompe el build sin TTY (CI, scripts de deploy). Arranca limpio
# desde "base" e instala solo dependencias de producción directamente.
FROM base AS prod-deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile --prod
RUN pnpm --filter @akyuam/api exec prisma generate

FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache openssl
WORKDIR /repo
# entrypoint.sh corre "pnpm exec prisma migrate deploy" — sin estos manifiestos,
# corepack no encuentra el campo "packageManager" (pnpm@10.34.5) y cae a la
# última versión de pnpm, que exige Node >=22.13 e incompatible con
# node:20-alpine: cada "pnpm exec" crashea con ERR_UNKNOWN_BUILTIN_MODULE.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY --from=prod-deps /repo/node_modules node_modules
COPY --from=prod-deps /repo/apps/api/node_modules apps/api/node_modules
COPY --from=prod-deps /repo/packages/shared/node_modules packages/shared/node_modules
COPY --from=build /repo/packages/shared/package.json packages/shared/package.json
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY apps/api/entrypoint.sh apps/api/entrypoint.sh
RUN chmod +x apps/api/entrypoint.sh
WORKDIR /repo/apps/api
USER node
# El puerto real lo define API_PORT (env var) en runtime, no un valor fijo aquí —
# ver "expose" parametrizado en docker-compose.yml. Este EXPOSE es solo metadata
# informativa para quien lea el Dockerfile de forma aislada.
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
