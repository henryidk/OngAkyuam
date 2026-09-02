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
  prisma/schema.prisma  modelo de datos (hoy: solo un modelo placeholder;
                         el modelo real de casos/usuarias/áreas/permisos
                         es una tarea aparte, todavía no implementada)
  prisma/migrations/   historial de migraciones
  Dockerfile           build de producción multi-stage

apps/web/            Frontend React + Vite + Tailwind + React Router
  src/App.tsx           definición de rutas
  src/pages/            una página placeholder por área (gerencia,
                         trabajo-social, jurídica, psicológica, médica)
  Dockerfile           build de producción multi-stage (sirve con nginx)

packages/shared/     Schemas de Zod compartidos entre frontend y backend,
                      para validar el mismo formulario en ambos lados sin
                      que se desincronicen

docker-compose.yml   Postgres local únicamente (bindeado a 127.0.0.1)
.env.example         nombres de variables de entorno requeridas (sin valores)
```

## Requisitos

- Node.js 20+
- pnpm 10+ (bloquea por defecto los scripts de instalación de dependencias nuevas — ver [Seguridad de dependencias](#seguridad-de-dependencias))
- Docker y Docker Compose (para Postgres y Redis locales)

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
4. Levantar Postgres local:
   ```
   docker compose up -d postgres
   ```
   Si ya tienes otro Postgres corriendo en el 5432, cambia `POSTGRES_PORT` en `.env` (y el puerto correspondiente en `DATABASE_URL`) antes de levantar el contenedor.
5. Aplicar las migraciones de Prisma:
   ```
   pnpm --filter @akyuam/api exec prisma migrate dev
   ```
6. Arrancar el backend (desde la raíz):
   ```
   pnpm dev:api
   ```
7. Arrancar el frontend (desde la raíz, en otra terminal):
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
