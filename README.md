# AKyuam

Sistema de gestión de casos para una ONG de atención a sobrevivientes de violencia.

Flujo de trabajo: **gerencia** registra a la usuaria que busca ayuda → refiere a **trabajo social** → trabajo social hace entrevistas y refiere el caso a una o varias áreas (**jurídica**, **psicológica**, **médica**) según corresponda. Cada área ve únicamente los datos de formulario y los archivos que **trabajo social autorice explícitamente** — todo es privado por defecto.

Los documentos de entrevista se seguirán llenando a mano en papel (eso no cambia); adicionalmente se capturará información rápida en formularios digitales, y los documentos físicos se escanearán y subirán al sistema.

Es una sola aplicación (SPA) conectada a un solo backend, con un único login — pero cada área tiene su propia interfaz separada dentro de la misma app.

Los datos que maneja el sistema son altamente sensibles (información de sobrevivientes de violencia). Cualquier trabajo en este repo — código, datos de prueba, commits — debe tratarse con ese nivel de cuidado. Ver [`CLAUDE.md`](./CLAUDE.md) para el detalle completo de reglas de proceso (credenciales, exposición de red, migraciones, datos reales).

## Stack

- **Backend**: NestJS + Prisma + PostgreSQL
- **Frontend**: React + Vite + TypeScript + Tailwind + React Router
- **Archivos**: Cloudflare R2 (privados, acceso vía URLs firmadas emitidas por el backend)
- **Monorepo**: pnpm workspaces (`apps/api`, `apps/web`, `packages/shared`)
- **Infraestructura**: Docker, DigitalOcean Droplet, dominio y proxy en Cloudflare
- **Redis**: bloqueo de intentos de login, cache de sesión

Detalles y justificación completa de cada decisión en [`CLAUDE.md`](./CLAUDE.md).

## Estructura del proyecto

```
apps/api/           Backend NestJS + Prisma
  src/main.ts          punto de entrada
  src/prisma/          PrismaModule / PrismaService (conexión a Postgres)
  src/auth/            módulo de login (JWT doble token en cookies, Redis,
                        lockout, auditoría) — ver login.md
  prisma/schema.prisma  modelo de datos (Usuario, RefreshToken, AuditLog)
  prisma/migrations/   historial de migraciones
  prisma/seed.ts        crea los usuarios ficticios de cada área (ver abajo)
  Dockerfile           build de producción multi-stage

apps/web/            Frontend React + Vite + Tailwind + React Router
  src/App.tsx           definición de rutas
  src/pages/            login, cambio de contraseña, y una página
                         placeholder por área (trabajo-social, jurídica,
                         psicológica, médica, admin)
  Dockerfile           build de producción multi-stage (sirve con nginx)

packages/shared/     Schemas de Zod compartidos entre frontend y backend,
                      para validar el mismo formulario en ambos lados sin
                      que se desincronicen

docker-compose.yml            base: define api/web (build de producción), postgres, redis
docker-compose.override.yml   dev local: postgres/redis bindeados a 127.0.0.1,
                               api-dev (backend con hot-reload en Docker), y deja
                               api/web de producción bajo el profile "production"
apps/api/Dockerfile.dev       imagen de dev de api-dev (no es la de producción)
.nvmrc                         versión de Node fijada, para nvm/nvm-windows/fnm
.env.example                  nombres de variables de entorno requeridas (sin valores)
```

## Requisitos

- Node.js 20+ (versión exacta en `.nvmrc` — con nvm/nvm-windows/fnm, `nvm use`)
- Después de instalar Node: `corepack enable` una sola vez por máquina. Lee el
  campo `packageManager` del `package.json` raíz y deja instalada la versión
  exacta de pnpm que usa el proyecto, igual en Windows que en Linux — no
  instalar pnpm por separado.
- Docker y Docker Compose (para Postgres, Redis y el backend en dev — ver abajo)

## Levantar el proyecto en local

1. Clonar el repo.
2. Copiar `.env.example` a `.env` en la raíz y completar los valores (usuario, contraseña y nombre de la base local). **`.env` nunca se commitea** — ya está en `.gitignore`.
   ```
   cp .env.example .env
   ```
3. Instalar dependencias del monorepo:
   ```
   pnpm install
   ```
4. Levantar Postgres, Redis y el backend (`api-dev`, con hot-reload vía bind mount):
   ```
   docker compose up -d
   ```
   Si ya tienes otro Postgres corriendo en el 5432, cambia `POSTGRES_PORT` en `.env` (y el puerto correspondiente en `DATABASE_URL`) antes de levantar el contenedor. Lo mismo aplica a `API_PORT` si el 3000 ya está en uso.

   El backend corre en un contenedor Linux (Alpine) para que todo el equipo compile y ejecute `bcrypt` (dependencia con binding nativo) en el mismo entorno, sin importar si la máquina es Windows o Linux — evita el clásico "en mi máquina sí funciona" por diferencias de compilación nativa entre sistemas operativos. Si el hot-reload no detecta cambios en Windows, ya está resuelto con `CHOKIDAR_USEPOLLING=true` en `docker-compose.override.yml`.

   Alternativa nativa (sin Docker para el backend) para quien prefiera no depender de contenedores y no tenga problemas de compilación con `bcrypt` en su máquina:
   ```
   docker compose up -d postgres redis
   pnpm dev:api
   ```
5. Aplicar las migraciones de Prisma:
   ```
   pnpm --filter @akyuam/api exec prisma migrate dev
   ```
   Si el backend está corriendo vía Docker (`api-dev`), este comando igual se corre desde el host — Prisma CLI se conecta a Postgres por el puerto publicado en `127.0.0.1`.
6. Crear los usuarios ficticios de cada área (solo hace falta una vez; si ya existen, el script los omite):
   ```
   pnpm --filter @akyuam/api exec prisma db seed
   ```
   Las contraseñas temporales se imprimen únicamente en la consola — cópialas de ahí, no quedan guardadas en ningún archivo del repo. Cada usuario debe cambiarla en su primer login.
7. Arrancar el frontend (desde la raíz, en otra terminal — se queda nativo, no corre en Docker):
   ```
   pnpm dev:web
   ```

### Comandos útiles

- `pnpm build` — build de producción de todos los workspaces.
- `pnpm --filter @akyuam/api exec prisma migrate status` — confirma que el esquema de la base local está sincronizado con las migraciones antes de seguir programando (correr siempre al retomar el trabajo después de una pausa).
- `pnpm --filter @akyuam/shared build` — compila los schemas compartidos (necesario si `api` o `web` no ven cambios recientes en `packages/shared`).

## Seguridad de dependencias

El proyecto usa **pnpm 10+**, que bloquea por defecto los scripts de instalación (`postinstall`, etc.) de cualquier dependencia nueva — solo corren los que se aprueben explícitamente vía `pnpm approve-builds`, lo que registra el paquete en el bloque `allowBuilds` de `pnpm-workspace.yaml` (`true` para permitirlo, `false` para bloquearlo explícitamente). Esto mitiga ataques de supply-chain vía paquetes npm comprometidos (código malicioso que se ejecuta automáticamente al instalar). Reglas a mantener:

- **Nunca aprobar un script de instalación sin revisar primero para qué lo usa el paquete** (el propio código del script en `node_modules`, no solo el nombre del paquete) — la mayoría son legítimos (compilar un binding nativo, descargar un binario de motor como hace Prisma), pero la aprobación es exactamente el punto que este mecanismo protege.
- Correr `pnpm audit` antes de dar por cerrado cualquier cambio que agregue o actualice dependencias, revisando manualmente cualquier vulnerabilidad reportada antes de ignorarla — incluyendo dependencias transitivas nuevas que aparezcan solo por actualizar un paquete existente, no solo al agregar uno nuevo.
- Revisar el diff de `package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml` en cada PR que agregue o actualice una dependencia — no fusionar sin que alguien más del equipo lo haya visto.
- Si una dependencia transitiva trae una versión vulnerable fijada por su propio paquete (no por nosotros), usar `pnpm.overrides` en el `package.json` raíz para forzar la versión parchada, y dejar un comentario o mención en el PR explicando por qué existe ese override — así no queda como una entrada "misteriosa" del lockfile.
