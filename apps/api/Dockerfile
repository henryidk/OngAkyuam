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

FROM deps AS prod-deps
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile --prod
RUN pnpm --filter @akyuam/api exec prisma generate

FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache openssl
WORKDIR /repo
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
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
