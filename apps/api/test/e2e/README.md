# Pruebas E2E

Corren contra un Postgres y un Redis **propios y desechables**, nunca los de desarrollo ni
producción. `entorno-e2e.ts` se niega a arrancar si la base no termina en `_e2e`. Todos los
datos que crean las pruebas son ficticios (`FICTICIO-E2E`).

En CI las corre el job `migraciones-y-e2e`. En local:

```sh
# 1. Contenedores desechables, solo en 127.0.0.1 y sin contraseña (se borran al detenerlos).
docker run -d --rm --name akyuam-e2e-pg -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_DB=akyuam_e2e -p 127.0.0.1:55432:5432 postgres:16-alpine
docker run -d --rm --name akyuam-e2e-redis -p 127.0.0.1:56379:6379 redis:7-alpine

# 2. Desde apps/api: migraciones y pruebas.
export E2E_DATABASE_URL="postgresql://postgres@127.0.0.1:55432/akyuam_e2e?schema=public"
export E2E_REDIS_URL="redis://127.0.0.1:56379"
DATABASE_URL="$E2E_DATABASE_URL" pnpm exec prisma migrate deploy
pnpm test:e2e --runInBand

# 3. Al terminar.
docker stop akyuam-e2e-pg akyuam-e2e-redis
```
