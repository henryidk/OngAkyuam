# Plan: Login de Akyuam (4 áreas + Administración)

## Contexto

El equipo necesita empezar a trabajar ya, así que el primer entregable real del sistema (más allá de mockups) es el **login** con acceso diferenciado por área (Trabajo Social, Jurídico, Psicología, Médica) y por el rol de Administración. Por ahora cada área — incluida Administración — solo necesita una pantalla placeholder protegida detrás del login; el contenido real de cada una, incluido el futuro panel de gestión de cuentas del personal (crear, resetear contraseña, desactivar), es trabajo posterior (ver sección 4).

El usuario compartió `especificacionesLogin.md`, la arquitectura de auth de otro proyecto suyo (NestJS + React, JWT de doble token, Redis, lockout, auditoría), pidiendo replicar el patrón aquí. Se usa como base, con dos adaptaciones deliberadas:

1. **Cookies httpOnly para ambos tokens, no `localStorage`.** `CLAUDE.md` ya decidió esto explícitamente para Akyuam ("no localStorage, para evitar robo de token vía XSS") — decisión tomada por la sensibilidad del dato (sobrevivientes de violencia), no un descuido a corregir. El otro proyecto pone el access token en `localStorage`; aquí ambos tokens van en cookies `httpOnly`, y por eso se agrega **CSRF** (protección de doble cookie) para las rutas que mutan estado, ya que el navegador adjunta las cookies automáticamente.
2. **Redis sí se incorpora** (confirmado con el usuario) para lockout de intentos fallidos y cache del usuario autenticado, replicando el patrón del otro proyecto. Sigue la disciplina de red de `CLAUDE.md`: `expose` en `docker-compose.yml` (nunca `ports`, nunca `0.0.0.0`), con una entrada en `docker-compose.override.yml` que publica el puerto solo a `127.0.0.1` para poder inspeccionarlo en local — mismo patrón que ya existe para Postgres.

El scaffold del monorepo (`apps/api` NestJS+Prisma, `apps/web` Vite+React+Tailwind, `packages/shared`) ya existe y funciona (contradice la nota "Estado actual" de `CLAUDE.md`, que quedó desactualizada — se corrige aparte, no en este plan). También existe `apps/web/src/pages/Gerencia.tsx`, residuo de una versión anterior del flujo — se elimina en este plan porque `instrucciones.md` ya estableció que no existe un rol "Gerencia".

Roles del sistema (`instrucciones.md` §2): `TRABAJO_SOCIAL`, `JURIDICO`, `PSICOLOGIA`, `MEDICA`, `ADMINISTRACION`. Una cuenta = un rol.

**Alcance explícito de este entregable (confirmado con el usuario, revisado):** lo único que se construye ahora es el **login**. Las **5** pantallas post-login (Trabajo Social, Jurídico, Psicología, Médica, **y también Administración**) son **archivos reales, componentes y rutas independientes**, pero con contenido **texto plano, sin diseño ni funcionalidad** — cada una muestra únicamente un `<h1>` con el nombre del área, nada más. Esto incluye a Administración: **el panel de administración (crear/desactivar/resetear usuarios) queda fuera de alcance de este entregable** — no se construye el módulo backend ni la pantalla funcional; el rol `ADMINISTRACION` sí puede loguearse y llega a su propia ruta placeholder (`<h1>Administración</h1>`), igual que las demás áreas. Los usuarios ficticios de las 5 áreas se crean igual vía el script de seed (sección 5), que no depende del panel de administración. El login mismo se mantiene **visualmente sencillo** (formulario simple, sin tratamiento visual elaborado) — lo prioritario es que funcione, no cómo se ve.

**Nota de idioma:** por pedido explícito del usuario, se refuerza en `CLAUDE.md` que la regla "responder siempre en español" cubre también el texto de herramientas interactivas (preguntas y opciones de `AskUserQuestion`, contenido de archivos de plan, etc.), no solo los mensajes de chat — ver paso 0.

---

## 0. Actualizaciones a `CLAUDE.md` y `README.md` (antes de programar)

Ambos archivos tienen contenido desactualizado o incompleto de cara a este entregable y al resto del proyecto — se corrigen como primer paso de la ejecución, antes de tocar código.

### 0.1. `CLAUDE.md`

- **Regla de idioma**: agregar a `## Idioma` que la regla de responder siempre en español cubre también el texto de herramientas interactivas (preguntas/opciones de `AskUserQuestion`, contenido de archivos de plan, encabezados de tools), no solo los mensajes de chat.
- **Corregir "Gerencia" en `## Flujo de trabajo (dominio)`**: el paso 1 todavía dice "Gerencia registra..." — ese rol ya no existe (confirmado en `instrucciones.md`); Trabajo Social es el primer punto de atención. Reescribir el paso 1 en consecuencia.
- **Agregar Redis a `## Stack decidido`**: nueva viñeta documentando la decisión (confirmada con el usuario en esta conversación) de usar Redis para bloqueo de intentos fallidos de login y cache del usuario autenticado, con la misma disciplina de red que el resto de servicios (`expose`, nunca `ports`, nunca `0.0.0.0`).
- **Nueva regla de proceso — zona horaria y fechas** (mismo espíritu que la regla de migraciones ya existente, para evitar errores futuros): documentar que todo el proyecto sigue el criterio de la sección 9 de este plan — `@db.Date` para fechas de calendario sin hora vs `@db.Timestamptz(3)` para instantes reales, conversión a `America/Guatemala` únicamente vía las utilidades de `packages/shared/src/timezone.ts` (Luxon, por nombre de zona IANA, nunca offset manual), contenedores con `TZ: UTC` explícito. Esta regla se conecta directamente con la disciplina de migraciones de Prisma ya existente: **cualquier campo de fecha nuevo en `schema.prisma` debe declararse con el tipo correcto (`@db.Date` o `@db.Timestamptz(3)`) desde la misma migración que lo introduce** — nunca un `DateTime` genérico "para corregir después", que es precisamente la clase de descuido que esa regla ya existe para evitar.
- **Corregir `## Estado actual`**: ya no es cierto que "el directorio contiene solo el contexto del proyecto" — el scaffold del monorepo existe y funciona, y el login (este plan) es el trabajo real en curso sobre él. Reescribir para reflejar el estado real y enlazar a `login.md` (raíz del proyecto, sección 0.3) como referencia del trabajo en curso.

### 0.2. `README.md`

- **Corregir "Estructura del proyecto"**: la lista de páginas placeholder en `apps/web` todavía menciona "gerencia" — se actualiza a las 5 reales (trabajo-social, jurídica, psicológica, médica, administración) al mismo tiempo que se crean/eliminan esos archivos (sección 6 de este plan).
- **Agregar Redis a la lista de Stack**: viñeta "Redis (bloqueo de intentos de login, cache de sesión)", junto a Postgres.
- Los pasos de "Levantar el proyecto en local" se actualizan durante la implementación de las secciones 1 (Redis) y 5 (seed) de este plan: agregar `redis` al comando `docker compose up -d postgres redis`, y un paso nuevo indicando cómo correr el seed de usuarios ficticios y leer las contraseñas temporales impresas en consola.

### 0.3. Copia del plan en la raíz del proyecto

Se guarda una copia de este plan, ya aprobado, en `ongAkyuam/login.md` — pedido explícito del usuario, para poder leerlo directamente sin depender de la carpeta de planes de Claude Code.

## 1. Infraestructura: Redis

- **`docker-compose.yml`**: nuevo servicio `redis` (imagen `redis:7-alpine`), `expose: ["6379"]` (nunca `ports`), volumen para persistencia de lockouts/cache (opcional pero simple: `redis_data:/data`), healthcheck (`redis-cli ping`). `api` pasa a depender también de `redis` (`condition: service_healthy`).
- **`docker-compose.override.yml`**: agregar `redis: ports: - "127.0.0.1:${REDIS_PORT:-6379}:6379"` para poder usar `redis-cli` desde el host en dev local, igual que Postgres.
- **`.env.example`**: agregar `REDIS_PORT=6379` (para tooling local) y `REDIS_URL=` (con comentario explicando la doble forma: `redis://127.0.0.1:${REDIS_PORT}` en local con `pnpm dev`, vs `redis://redis:6379` dentro de Docker — mismo patrón que `DATABASE_URL`). **Ninguna contraseña de Redis se sube versionada** (si se decide poner password a Redis, vía env var como las demás).
- `apps/api`: agregar dependencia `ioredis`.

## 2. Modelo de datos (`apps/api/prisma/schema.prisma`)

Reemplaza el modelo `Placeholder` (o convive, a decidir al migrar — probablemente se borra ya que era explícitamente un placeholder). Se agrega:

```prisma
enum Rol {
  TRABAJO_SOCIAL
  JURIDICO
  PSICOLOGIA
  MEDICA
  ADMINISTRACION
}

model Usuario {
  id                  String    @id @default(uuid())
  nombreCompleto      String
  username            String    @unique
  passwordHash        String
  rol                 Rol
  isActive            Boolean   @default(true)
  mustChangePassword  Boolean   @default(true)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  refreshTokens       RefreshToken[]
}

model RefreshToken {
  id          String    @id @default(uuid())
  tokenHash   String    @unique   // sha256 del JWT, nunca el token en claro
  usuarioId   String
  usuario     Usuario   @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  expiresAt   DateTime  @db.Timestamptz(3)
  revoked     Boolean   @default(false)
  revokedAt   DateTime? @db.Timestamptz(3)
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime  @default(now()) @db.Timestamptz(3)

  @@index([usuarioId])   // consulta frecuente: "todos los refresh tokens activos de este usuario" al desactivar/resetear
}

model AuditLog {
  id          String    @id @default(uuid())
  usuarioId   String?
  username    String?
  accion      String    // LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, USER_CREATED, PASSWORD_RESET, USER_DEACTIVATED, ...
  entidad     String?   // pensado a futuro para auditar acceso a expedientes/documentos, no solo auth
  entidadId   String?
  ipAddress   String?
  userAgent   String?
  detalles    Json?
  createdAt   DateTime  @default(now()) @db.Timestamptz(3)

  @@index([usuarioId])
  @@index([accion, createdAt])   // reportes/filtros por tipo de evento y rango de fecha
}
```

Todos los campos de fecha usan `@db.Timestamptz(3)` explícito (Prisma por defecto mapea `DateTime` a `TIMESTAMP` sin zona horaria en Postgres) — evita ambigüedad de huso horario al correr auditorías o reportes.

Notas de diseño:
- `RefreshToken.tokenHash` guarda un hash (sha256), no el JWT en claro — mejora sobre el patrón del otro proyecto: si la tabla se filtra, los refresh tokens no son directamente reusables.
- **Sin columnas de lockout en `Usuario`** — el lockout vive enteramente en Redis (`login_failures:{username}`, `login_lockout:{username}`), como en la especificación original.
- `AuditLog` se diseña ya pensando en reutilizarse para el `audit_log` que `CLAUDE.md` pide para lecturas/escrituras sensibles de casos (no solo login) — evita rediseñarla cuando se construya esa parte.

Correr `prisma migrate dev --name add_usuarios_auth_auditoria` en el mismo cambio (regla de `CLAUDE.md`).

## 3. Backend — módulo `auth` (`apps/api/src/auth/`)

Dependencias nuevas: `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`, `cookie-parser`, `helmet`, `class-validator`, `class-transformer`, `@nestjs/throttler`, tipos correspondientes.

Estructura (adaptada de `especificacionesLogin.md` §2.1, con extractor de cookie en vez de header):

```
auth/
  auth.controller.ts        # POST login, POST refresh, POST logout, GET me
  auth.service.ts
  auth.module.ts
  dto/login.dto.ts
  strategies/jwt.strategy.ts   # extrae el access token de la cookie, no de Authorization header
  guards/
    jwt-auth.guard.ts
    roles.guard.ts
    must-change-password.guard.ts
    csrf.guard.ts              # nuevo: valida header X-CSRF-Token contra cookie csrfToken en mutaciones
  decorators/
    current-user.decorator.ts
    roles.decorator.ts
    public.decorator.ts        # @Public() — para login/refresh/health
    skip-must-change-password.decorator.ts
  interfaces/jwt-payload.interface.ts
redis/
  redis.module.ts
  redis.service.ts             # wrapper fino sobre ioredis, usado por auth (lockout + cache) y disponible a futuro
```

**Guard global**: se registra `JwtAuthGuard` como `APP_GUARD` en `AppModule` (patrón "todo protegido por defecto" que la propia especificación recomienda para un sistema nuevo — más apropiado aquí por la sensibilidad del dato) con `@Public()` para login/refresh/health-check. `RolesGuard` se aplica por controller/ruta donde se necesite restringir por rol (queda listo para el futuro módulo de administración — sección 4 — aunque en este entregable no protege ningún endpoint todavía). `MustChangePasswordGuard` también global, con `@SkipMustChangePassword()` en el endpoint de cambio de contraseña propio.

**Flujo de login** (`auth.service.login`, orden de `especificacionesLogin.md` §2.3, sin cambios de fondo):
1. Chequear `login_lockout:{username}` en Redis → `429` con segundos restantes si está bloqueado.
2. Buscar `Usuario` por `username` → si no existe, contar fallo + auditar + `401` genérico ("Credenciales incorrectas").
3. Chequear `isActive` → si no, auditar + `401` (sin contar como intento fallido).
4. `bcrypt.compare` → si falla, contar fallo (Redis) + auditar + `401` genérico.
5. Éxito → limpiar contador Redis, generar tokens, guardar `tokenHash` en `RefreshToken`, auditar `LOGIN_SUCCESS`.
6. Responder `{ user, mustChangePassword }` (sin tokens en el body) y setear 3 cookies:
   - `accessToken` — httpOnly, Secure (prod), SameSite=Strict, Path=`/`, ~15 min.
   - `refreshToken` — httpOnly, Secure (prod), SameSite=Strict, Path=`/api/auth`, ~7 días.
   - `csrfToken` — **no** httpOnly (el frontend debe poder leerla), Secure (prod), SameSite=Strict, mismo `Path=/`, mismo `maxAge` que el access token.

**Refresh** (`POST /api/auth/refresh`, `@Public()`): lee `refreshToken` de la cookie (no de body), valida firma + que `RefreshToken.revoked = false` en DB + usuario activo, emite nuevo `accessToken` (y nuevo `csrfToken`) como cookies. Sin rotación de refresh token, igual que el original.

**Logout** (`POST /api/auth/logout`): marca el `RefreshToken` actual como revocado, limpia las 3 cookies.

**`GET /api/auth/me`**: devuelve el usuario autenticado (para que el frontend rehidrate sesión al cargar la app, ya que no hay token legible en `localStorage` — reemplaza la rehidratación desde `localStorage` del proyecto original).

**JwtStrategy** (cache-first, `especificacionesLogin.md` §2.10): extrae el JWT de la cookie `accessToken` (extractor custom de `passport-jwt`), valida contra cache en Redis (`TTL 5 min`, menor que los 15 min del access token) antes de golpear Postgres. Invalidar la key de cache en cualquier mutación del usuario (desactivar, resetear password, cambiar rol).

**CSRF**: `CsrfGuard` global (o aplicado a todo verbo mutante), compara cookie `csrfToken` contra header `X-CSRF-Token` en `POST/PUT/PATCH/DELETE`. Rutas `@Public()` (login) quedan exentas porque ahí todavía no hay sesión.

**Lockout Redis**: constantes `MAX_ATTEMPTS=5`, `LOCKOUT_TTL=60s`, `FAILURES_TTL=120s`, claves `login_failures:{username}` / `login_lockout:{username}` — igual que la especificación.

**Bootstrap** (`main.ts`, orden de `especificacionesLogin.md` §2.13): `compression()`, `helmet()`, `cookie-parser()`, filtro global de excepciones, `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`, CORS restringido a `FRONTEND_URL` con `credentials: true`, prefijo global `/api`. Validación de env vars al boot con **Zod** (no Joi — consistente con el resto del stack, que ya usa Zod en `packages/shared`): exige `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (≥32 chars), `DATABASE_URL`, `REDIS_URL`, `FRONTEND_URL`.

## 4. Fuera de alcance en este entregable: panel de Administración

**Confirmado con el usuario**: el módulo backend de administración (crear cuentas, resetear contraseña, desactivar/reactivar — controller, service, DTOs, endpoints `POST/GET/PATCH /api/admin/usuarios...`) y la pantalla funcional `pages/admin/Usuarios.tsx` **no se construyen en este entregable**. Se deja como trabajo futuro, ya con el modelo de datos (`Usuario`, `RefreshToken`, `AuditLog`) y el `RolesGuard`/`@Roles('ADMINISTRACION')` listos para soportarlo cuando se retome.

Mientras tanto, la gestión de las 5 cuentas ficticias (una por área + Administración) se resuelve enteramente con el script de seed (sección 5) — no depende de un panel. El rol `ADMINISTRACION` sí existe, sí puede loguearse, y llega a su propia pantalla placeholder (`<h1>Administración</h1>`) como las demás áreas (ver sección 6).

## 5. Seed de usuarios ficticios (`apps/api/prisma/seed.ts`)

Script de Prisma seed (`"prisma": { "seed": "ts-node prisma/seed.ts" }` en `apps/api/package.json`) que crea, si no existen:
- 1 usuario `ADMINISTRACION`
- 1 usuario por área: `TRABAJO_SOCIAL`, `JURIDICO`, `PSICOLOGIA`, `MEDICA`

Cada uno con contraseña temporal generada aleatoriamente al correr el script, **impresa solo en la consola** (nunca escrita a un archivo del repo), `mustChangePassword = true`. Se corre con `pnpm --filter @akyuam/api exec prisma db seed` — el usuario copia las contraseñas de la terminal para dárselas a sus compañeros.

## 6. Frontend (`apps/web/src/`)

Dependencias nuevas: `axios`, `zustand`.

- **`lib/api.ts`**: instancia axios `withCredentials: true`. Sin interceptor de `Authorization` (las cookies viajan solas). Interceptor de **request** que agrega `X-CSRF-Token` leyendo la cookie `csrfToken` en verbos mutantes. Interceptor de **response**: mismo patrón de cola (`isRefreshing` + `failedQueue`) de `especificacionesLogin.md` §3.2, pero disparando `POST /api/auth/refresh` (sin leer body de token, las cookies se actualizan solas); si el refresh también falla, limpia el store y redirige a `/login`. Excluye `/auth/login` y `/auth/refresh` del loop, igual que el original.
- **`store/auth.store.ts`** (Zustand): estado `{ user, isAuthenticated, isLoading, mustChangePassword }`. **Nada de tokens en el store ni en `localStorage`** (viven solo en cookies httpOnly, invisibles a JS). `checkAuth()` llama a `GET /api/auth/me` al montar la app para rehidratar sesión — reemplaza la rehidratación desde `localStorage` del proyecto original, ya que aquí no hay token legible por JS.
- **`routes/ProtectedRoute.tsx`** y **`routes/PublicRoute.tsx`**: mismo comportamiento que `especificacionesLogin.md` §3.4 (redirect a `/login` si no autenticado; redirect a la home del propio rol si autenticado pero sin permiso; modal bloqueante si `mustChangePassword`). Mapeo rol → ruta home centralizado en un solo diccionario, ej.:
  ```
  { TRABAJO_SOCIAL: '/trabajo-social', JURIDICO: '/juridico', PSICOLOGIA: '/psicologia', MEDICA: '/medica', ADMINISTRACION: '/admin' }
  ```
- **`pages/Login.tsx`**: formulario username/password simple (React Hook Form + Zod, consistente con el resto del stack) — **sin tratamiento visual elaborado**, solo lo funcional: deshabilita submit durante `isLoading` o countdown de lockout, parsea el `429` para mostrar countdown, redirige si ya autenticado.
- **`pages/CambiarPassword.tsx`**: pantalla/modal simple para el primer login (`mustChangePassword`), mismo criterio de sencillez.
- **Placeholders por área — archivos y rutas separados de verdad, no un solo componente condicionado por rol.** Son y seguirán siendo **5 paneles distintos** (5 componentes, 5 archivos, 5 rutas independientes) — las 4 áreas más Administración: `pages/TrabajoSocial.tsx` → `/trabajo-social`, `pages/Juridica.tsx` → `/juridico`, `pages/Psicologica.tsx` → `/psicologia`, `pages/Medica.tsx` → `/medica`, y **`pages/admin/Administracion.tsx`** → `/admin` (nuevo — reemplaza lo que antes iba a ser la pantalla funcional de usuarios; el panel de administración real queda diferido, ver sección 4). Cada archivo es el punto donde el compañero de esa área (o, en el caso de Administración, trabajo futuro del propio usuario) construirá el panel real más adelante, sin tocar los demás. El contenido de cada archivo en este entregable es únicamente un `<h1>` con el nombre del área (ej. `Juridica.tsx` → `<h1>Jurídico</h1>`, `Administracion.tsx` → `<h1>Administración</h1>`) — la separación en componentes/archivos/rutas independientes es real desde ahora, no una capa de texto sobre un componente genérico. **Eliminar `pages/Gerencia.tsx`** (rol que ya no existe, confirmado en `instrucciones.md`).
- **`App.tsx`**: define las rutas (`/login` pública, resto protegidas por rol) usando los wrappers anteriores.

## 7. `.env.example` — variables nuevas

```
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
FRONTEND_URL=
REDIS_PORT=6379
REDIS_URL=
```
Con comentarios explicando cada una (igual que ya se hace con `DATABASE_URL`), y la regla existente de `CLAUDE.md`: nombres documentados aquí, valores nunca versionados.

## 8. Principios de código, seguridad y optimización de base de datos

### 8.1. SOLID / Clean Code aplicado a este módulo

- **Responsabilidad única**: `AuthService` no hace de todo — se descompone en providers inyectables separados: `TokenService` (firmar/verificar JWT, generar `tokenHash`), `LockoutService` (lógica de intentos fallidos/bloqueo en Redis), `AuditService` (escribir en `AuditLog`), `CookieService` (setear/limpiar las 3 cookies con las flags correctas en un solo lugar, para no repetir esa configuración en `login` y en `refresh`). `AuthService` los orquesta, no reimplementa su lógica.
- **Inversión de dependencias**: todo se inyecta vía el contenedor de NestJS (constructor injection) — nunca `new AlgunService()` a mano. `RedisService` se expone como una interfaz delgada sobre `ioredis`, para que `LockoutService`/`JwtStrategy` dependan de esa interfaz y no del cliente concreto.
- **Abierto/cerrado**: nuevos roles o nuevas rutas protegidas se agregan por configuración/decoradores (`@Roles(...)`, `@Public()`), sin tocar la lógica interna de los guards existentes.
- **Segregación de interfaces**: DTOs estrechos y específicos por caso de uso (`LoginDto` solo acepta `username`/`password`; el futuro `CrearUsuarioDto` del panel de administración deberá seguir el mismo criterio — nunca aceptar `isActive`/`mustChangePassword`/`passwordHash`, solo lo que el admin realmente debe poder mandar); `class-validator` con `whitelist`+`forbidNonWhitelisted` como red de seguridad adicional contra mass assignment en todo el módulo.
- **Sin duplicación**: constantes de configuración (`MAX_ATTEMPTS`, TTLs, duración de tokens) centralizadas en un único archivo de configuración, no repetidas como literales en varios services.
- **Nombres consistentes con el resto del proyecto**: entidades de dominio en español (`Usuario`, `Rol`), términos de infraestructura en inglés donde ya es la convención del código (`RefreshToken`, `AuditLog`) — igual criterio que ya sigue `instrucciones.md`/`schema.prisma` actual.

### 8.2. Checklist de seguridad (además de lo ya cubierto en las secciones 3-4: cookies httpOnly+Secure+SameSite, CSRF, lockout, mensajes genéricos, auditoría, `ValidationPipe` estricto)

- `bcrypt` con **12 rounds** (no 10) — costo de cómputo aceptable para el volumen de logins de un panel interno, y más margen ante hardware que mejora con el tiempo.
- **El hash de contraseña nunca sale de la base de datos**: `select` explícito (nunca `select: { ... }` implícito de "todos los campos") en cualquier consulta Prisma que devuelva un `Usuario` hacia el cliente — construir un tipo `UsuarioPublico` reutilizable que excluye `passwordHash`.
- Contraseñas temporales generadas por el servidor (no elegidas por el admin) con suficiente entropía (ej. 12+ caracteres aleatorios, no un patrón predecible tipo `nombre123`).
- **Principio de mínimo privilegio en Postgres**: el usuario/rol de base de datos que usa la app en producción no debe ser el superusuario de Postgres — un rol propio con permisos solo sobre el schema de la app.
- **Nunca loguear contraseñas** (ni en texto plano ni hasheadas) en logs de aplicación (pino) ni en `AuditLog.detalles`, ni siquiera en un intento fallido.
- Revisar dependencias nuevas (`bcrypt`, `passport-jwt`, `ioredis`, etc.) con `pnpm audit` antes de dar por cerrado el módulo, y dejarlo como práctica recurrente (Dependabot o similar más adelante, fuera de alcance de este plan).
- (Para cuando se construya el panel de administración, sección 4): confirmar que solo `ADMINISTRACION` puede crear cuentas con `rol: ADMINISTRACION` (evita escalamiento de privilegios) — el guard del controller ya lo descarta, pero vale la pena un test explícito de este caso.
- Todo lo de la sección 3 (CORS restringido a `FRONTEND_URL`, `helmet`, prefijo `/api`, secrets ≥32 chars validados al boot) se trata como parte de este checklist, no como algo aparte.

### 8.3. Checklist de optimización de base de datos

- Índices explícitos para los patrones de consulta reales de este módulo (ya reflejados en el schema de la sección 2): `Usuario.username` único (login), `RefreshToken.tokenHash` único (validar refresh) y `RefreshToken.usuarioId` (revocar todos los tokens de un usuario al desactivarlo/resetear password), `AuditLog.usuarioId` y `AuditLog(accion, createdAt)` (para reportes/filtros futuros de auditoría).
- `onDelete: Cascade` en la relación `RefreshToken → Usuario` para integridad referencial (aunque el borrado real de usuarios no es el flujo esperado — se desactivan, no se eliminan — igual se define explícitamente en vez de dejarlo implícito).
- Timestamps con zona horaria (`@db.Timestamptz(3)`) en vez del default de Prisma, para que fechas de auditoría/expiración no dependan del huso horario del servidor.
- `DATABASE_URL` de producción con `connection_limit` explícito acorde al pool de conexiones del droplet (evita agotar conexiones del Postgres Managed de DigitalOcean si en el futuro corren varias instancias del API).
- Nada de queries N+1: los pocos listados de este módulo (`GET /api/admin/usuarios`) son consultas simples de una tabla, sin necesidad de `include` anidados por ahora.

## 9. Zona horaria y manejo de fechas (VPS Debian en DigitalOcean, hora de Guatemala)

Este sistema corre en un Droplet Debian de DigitalOcean; el personal que lo usa está en Guatemala (`America/Guatemala`, UTC-6, sin horario de verano hoy — pero el criterio siguiente no depende de que eso se mantenga así para siempre). El usuario ya validó este mismo problema en otro proyecto (`capturas/varios/fechas-timezone.md`): la separación entre **fecha de calendario** (sin hora) e **instante real** (con hora) es el punto que evita el bug silencioso clásico — una fecha guardada/leída sin ese cuidado puede mostrarse un día antes o después según la hora del día en que se consulte. Se adopta ese mismo criterio aquí, con una diferencia de implementación (sección 9.2).

### 9.1. Principio general (aplica a todo el proyecto, no solo a login)

Dos categorías de campo de fecha, sin excepción:
- **Instante real** (algo que ocurrió/ocurrirá en un momento exacto: login, expiración de token, hora de una consulta médica) → `@db.Timestamptz(3)` en Prisma, se guarda en UTC, se muestra convertido a `America/Guatemala`.
- **Fecha de calendario pura, sin hora** (fecha de nacimiento, "día" de trabajo social, fecha de una cita entendida como el día, no la hora) → `@db.Date` en Prisma, se trata siempre como el string `"YYYY-MM-DD"` que es, **nunca se envuelve en un objeto `Date`/instante** salvo para calcularlo, porque ahí es donde se cuela el bug de rollover de medianoche.

Ninguno de los campos de este entregable (`Usuario.createdAt/updatedAt`, `RefreshToken.*`, `AuditLog.createdAt`) es de tipo "fecha de calendario" — todos son instantes reales, ya correctos con `@db.Timestamptz(3)` (sección 2). El motivo para resolver esto ahora, aunque login no lo necesite todavía, es que el próximo trabajo del propio usuario (formularios reales de Trabajo Social, Jurídico, etc., ya identificados en `requerimientos.txt`: fecha de nacimiento, "día", fechas de cita) sí va a tener campos de este tipo, y conviene tener el criterio y las utilidades listas en vez de improvisarlas por área.

### 9.2. Librería: Luxon, no aritmética de offset manual

En vez de calcular `-6` a mano en ningún punto del código (fragil incluso siendo Guatemala fijo — no se debe depender de un número que alguien podría copiar mal o que quede huérfano si la política horaria cambiara), se resuelve la zona por su nombre IANA (`America/Guatemala`) a través de una librería probada: **Luxon** (activamente mantenida, estándar habitual en Node/TS para esto, más explícita que trabajar con `Date` a mano).

- Dependencia nueva `luxon` (+ `@types/luxon`) en **`packages/shared`** — no en `apps/api` ni `apps/web` por separado, para que backend y frontend usen exactamente las mismas funciones y no se dupliquen ni diverjan (mismo criterio que ya usan los schemas de Zod compartidos).
- Nuevo archivo `packages/shared/src/timezone.ts`:
  - `GUATEMALA_TZ = 'America/Guatemala'` — constante única, referenciada por nombre en todo el código, nunca un offset numérico literal.
  - `hoyGT(): string` — fecha de hoy en Guatemala como `"YYYY-MM-DD"` (`DateTime.now().setZone(GUATEMALA_TZ).toISODate()`). Se usa en el backend en vez de `new Date()` cada vez que se necesite "la fecha de hoy" del negocio (guardar o filtrar).
  - `inicioHoyGT(): Date` — medianoche de hoy en Guatemala, como instante UTC — para queries tipo "registros de hoy".
  - `formatFechaGT(iso: string): string` — formatea un `"YYYY-MM-DD"` para mostrar (ej. `"30/04/2026"`) por manipulación de string, **sin pasar por un objeto `Date`** — elimina por completo la clase de bug de rollover, porque un string de solo-fecha no tiene componente horaria que convertir.
  - `formatInstanteGT(fecha: Date | string): string` — formatea un instante real (`Timestamptz`) a hora de Guatemala para mostrarlo (`DateTime.fromJSDate(...).setZone(GUATEMALA_TZ)`).
  - `parseLocalGT(valorDatetimeLocal: string): Date` — interpreta un valor de `<input type="datetime-local">` como hora de **Guatemala** explícita (no la zona del sistema operativo del navegador) y devuelve el instante UTC correspondiente — más robusto que asumir que el reloj/zona de una laptop del personal está bien configurado.

### 9.3. Checklist de campos de fecha (para todo el proyecto, de aquí en adelante)

- ¿Es fecha de calendario sin hora? → `@db.Date` + `hoyGT()` para generarla, `formatFechaGT()` para mostrarla, nunca un objeto `Date` de por medio.
- ¿Es un instante real? → `@db.Timestamptz(3)` (ya aplicado en la sección 2), `formatInstanteGT()` para mostrarlo.
- ¿El backend necesita "la fecha de hoy" del negocio? → `hoyGT()` / `inicioHoyGT()`, nunca `new Date()` a secas.
- ¿El frontend recibe un `datetime-local` que representa una hora de Guatemala? → `parseLocalGT()`, no confiar en la zona horaria del navegador.
- ¿El backend serializa un campo `@db.Date` hacia el frontend? → como string `"YYYY-MM-DD"` explícito en el DTO de salida, nunca dejar que se serialice implícitamente como `Date` (Node lo convertiría a un ISO con hora y `Z`, ambiguo).

### 9.4. Capa base — contenedores

Se mantiene `TZ: UTC` explícito en los contenedores `postgres` y `api` de `docker-compose.yml` (y documentado para `pnpm dev:api` fuera de Docker) — no se asume que el droplet Debian venga en UTC por defecto, se fija. Esta es la base sobre la que Luxon hace después la conversión explícita a `America/Guatemala`; los JWT/cookies (`exp`, `maxAge`) son timestamps Unix y ya son independientes de zona horaria por construcción.

## 10. Verificación

1. `pnpm --filter @akyuam/api exec prisma migrate dev --name add_usuarios_auth_auditoria` y `pnpm --filter @akyuam/api exec prisma migrate status` (regla de `CLAUDE.md`, correr *status* después de migrar).
2. `docker compose up -d postgres redis` (perfil dev, según `docker-compose.override.yml`) + `pnpm --filter @akyuam/api exec prisma db seed` → confirmar en consola las 5 contraseñas temporales impresas.
3. `pnpm dev:api` + `pnpm dev:web`.
4. Probar manualmente en navegador: login con cada uno de los **5** usuarios ficticios (incluido `ADMINISTRACION`) → cada uno redirige a su propio placeholder (`/trabajo-social`, `/juridico`, `/psicologia`, `/medica`, `/admin` con su `<h1>` correspondiente); cambio de contraseña obligatorio en primer login; logout; 5 intentos fallidos seguidos → `429` con countdown; refresco de página mantiene sesión (cookies); un rol intentando entrar a la ruta de otro rol → redirige a su propia home, no a login.
5. Revisar la tabla `AuditLog` en Prisma Studio y confirmar que quedaron registrados los eventos de login exitoso/fallido con `createdAt` en UTC (ver sección 9) y verificar que, al convertir esa hora a `America/Guatemala`, coincide con la hora real en que se hizo la prueba.
6. (Fuera de este entregable, para cuando se retome) probar el módulo de administración una vez se construya — no aplica todavía.
