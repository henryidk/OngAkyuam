# Especificación del sistema de login — para replicar en otro sistema

Este documento describe, a nivel de **patrón arquitectónico** (no de código específico de Tunsa), cómo está construido el sistema de autenticación actual, para poder reimplementarlo en otro proyecto con un stack similar (NestJS/Express + React, o equivalente).

---

## 1. Visión general

Es un esquema de **JWT de doble token** (access + refresh) con:

- Access token de vida corta, enviado en header `Authorization: Bearer`.
- Refresh token de vida larga, guardado en **cookie httpOnly** (no accesible por JS) y también persistido en base de datos para poder revocarlo.
- Bloqueo temporal de cuenta tras varios intentos fallidos (Redis).
- Cache del usuario autenticado en Redis para no golpear la base de datos en cada request.
- Auditoría de intentos de login (éxito/fallo) en una tabla de base de datos.
- Guards de rol y de "debe cambiar contraseña" a nivel de framework backend.
- En frontend: store global de auth (Zustand), interceptores de axios para adjuntar el token y renovarlo automáticamente, y rutas protegidas por autenticación + rol.

```
Cliente (React)                    Servidor (NestJS)
─────────────────                  ──────────────────
Login.tsx  ──POST /auth/login──►   AuthController.login()
                                       └─ AuthService.login()
                                            ├─ checkLockout (Redis)
                                            ├─ buscar usuario (DB)
                                            ├─ bcrypt.compare
                                            ├─ generar accessToken + refreshToken (JWT)
                                            ├─ guardar refreshToken en DB
                                            └─ logAudit (DB)
                                   ◄── accessToken (JSON body)
                                   ◄── refreshToken (Set-Cookie httpOnly)
auth.store (Zustand)
  guarda accessToken en localStorage
  guarda user en localStorage
```

---

## 2. Backend — módulo de autenticación

### 2.1 Estructura de archivos (patrón a replicar)

```
auth/
  auth.controller.ts          # endpoints: login, refresh, logout, profile
  auth.service.ts             # lógica de negocio (lockout, bcrypt, tokens, auditoría)
  auth.module.ts              # wiring del módulo + registro de JwtModule
  dto/
    login.dto.ts              # validación de entrada (class-validator)
  strategies/
    jwt.strategy.ts           # Passport strategy: valida el access token, resuelve el usuario
  guards/
    jwt-auth.guard.ts         # AuthGuard('jwt') — protege rutas
    roles.guard.ts            # valida user.role contra @Roles(...)
    login-throttler.guard.ts  # throttling adicional sobre /auth/login
    must-change-password.guard.ts  # bloquea rutas si el usuario tiene password temporal
  decorators/
    current-user.decorator.ts        # @CurrentUser() → extrae request.user
    roles.decorator.ts               # @Roles('admin', ...)
    skip-must-change-password.decorator.ts  # excepciones al guard anterior
  interfaces/
    jwt-payload.interface.ts  # JwtPayload, AuthenticatedUser, UserWithRole
```

### 2.2 Modelo de datos necesario

- **User**: `id, username, password (hash bcrypt), nombre, role, isActive, mustChangePassword`.
- **RefreshToken**: `id, token, userId, expiresAt, revoked, revokedAt, ipAddress, userAgent`. Es la tabla que permite **revocación server-side** de refresh tokens (el access token nunca se revoca individualmente; solo expira).
- **AuditLog**: `id, userId?, username?, action (LOGIN_SUCCESS | LOGIN_FAILED | ...), ipAddress, userAgent, details (JSON), createdAt`.

### 2.3 Flujo de login (`AuthService.login`)

Orden exacto de pasos (importante conservar el orden por seguridad y consistencia de auditoría):

1. **Verificar lockout** contra Redis (`login_lockout:{username}`). Si existe y no ha expirado, responder `429 Too Many Requests` con el tiempo restante.
2. **Buscar usuario** por username. Si no existe: registrar intento fallido + auditoría (`reason: usuario no encontrado`) + `401 Unauthorized` con mensaje genérico ("Credenciales incorrectas" — nunca revelar si el username existe o no).
3. **Verificar `isActive`**. Si está inactivo: auditoría + `401`, sin contar como intento fallido de lockout (para no bloquear a alguien que igual no puede entrar).
4. **Verificar password** con `bcrypt.compare(password, hash)`. Si falla: registrar intento fallido + auditoría + `401` con el mismo mensaje genérico del paso 2 (para no filtrar si el usuario existe).
5. **Login exitoso** → limpiar contadores de intentos fallidos en Redis.
6. **Generar tokens** (ver 2.4) y persistir el refresh token en DB.
7. **Auditoría de éxito** (`LOGIN_SUCCESS`).
8. Responder con `accessToken`, `mustChangePassword`, y el objeto `user` (**nunca** incluir el hash de password en la respuesta).

### 2.4 Generación de tokens

```
accessToken  = JWT.sign({ sub: user.id, username, role }, JWT_SECRET,          { expiresIn: '15m' })
refreshToken = JWT.sign({ sub: user.id, username },        JWT_REFRESH_SECRET, { expiresIn: '7d' })
```

- Dos **secrets distintos** para access y refresh (si se filtra uno no compromete al otro).
- El payload del access token lleva lo mínimo necesario para autorizar (`sub`, `username`, `role`) — nunca datos sensibles.
- El refresh token se **persiste en la tabla `RefreshToken`** junto con `expiresAt`, `ipAddress`, `userAgent`. Esto es lo que permite revocarlo antes de que expire (logout, o revocación administrativa).

### 2.5 Lockout de intentos fallidos (Redis)

Constantes de referencia (ajustables):

```
MAX_ATTEMPTS  = 5
LOCKOUT_TTL   = 60 segundos   # cuánto dura el bloqueo
FAILURES_TTL  = 120 segundos  # tras cuánta inactividad se olvida el contador de fallos
```

Claves Redis:
- `login_failures:{username}` → contador de intentos fallidos consecutivos, TTL renovado en cada fallo.
- `login_lockout:{username}` → si existe, el usuario está bloqueado; valor = timestamp de expiración (para poder calcular "segundos restantes" sin depender del TTL exacto de Redis).

Al llegar a `MAX_ATTEMPTS`, se crea `login_lockout` y se borra `login_failures`. Este mecanismo es **independiente y adicional** a un throttling genérico por IP (ver 2.6) — uno protege por cuenta, el otro por origen de la petición.

### 2.6 Throttling adicional (opcional pero recomendado)

Un guard de throttling (p. ej. `@nestjs/throttler`) aplicado solo a la ruta de login, con tracking por IP o por combinación IP+username, como capa extra independiente del lockout de Redis. Sirve para mitigar fuerza bruta distribuida contra muchos usuarios distintos, algo que el lockout por username no cubre.

### 2.7 Transporte de tokens

- **Access token**: va en el **body de la respuesta JSON**. El frontend lo guarda (en este caso en `localStorage`) y lo reenvía en cada request como `Authorization: Bearer <token>`.
- **Refresh token**: **nunca** va en el body de forma legible por JS. Se setea como cookie:

```
Set-Cookie: refreshToken=<jwt>;
  HttpOnly;                        // no accesible desde JavaScript (mitiga XSS)
  Secure (solo en producción);     // solo por HTTPS
  SameSite=Strict;                 // mitiga CSRF
  Max-Age=7 días;
  Path=/api/auth;                  // el navegador solo la envía a rutas de auth, no a toda la API
```

El controller extrae el refresh token del body devuelto por el service (`login()` retorna `{ refreshToken, ...resto }`) y lo separa antes de responder al cliente, seteando la cookie aparte y devolviendo solo `resto` en el JSON.

### 2.8 Endpoint de refresh

`POST /auth/refresh` — no requiere `Authorization` header, usa la cookie httpOnly (por eso el frontend debe llamar con `withCredentials: true`).

1. Verificar firma/expiración del refresh token JWT.
2. Verificar en DB que el registro `RefreshToken` correspondiente existe y `revoked = false` (esto es lo que hace posible invalidar un refresh token antes de su expiración natural).
3. Verificar que el usuario siga existiendo y activo.
4. Emitir **solo un nuevo access token** (no se rota el refresh token en este esquema — simplificación válida; una variante más estricta rotaría también el refresh token en cada uso).

### 2.9 Logout

`POST /auth/logout` — marca el refresh token actual como `revoked = true, revokedAt = now()` en DB. El access token en curso sigue siendo técnicamente válido hasta que expira (máx. 15 min) porque no hay blacklist de access tokens — es una decisión de diseño consciente: se prioriza performance (no consultar Redis/DB en cada request solo para chequear blacklist) sobre revocación instantánea, aceptando una ventana de hasta 15 min. Si se necesita revocación inmediata, la alternativa es una blacklist en Redis de access tokens revocados, consultada en el `JwtStrategy`.

### 2.10 Passport JWT Strategy — patrón cache-first

```
validate(payload):
  cached = redisUserCache.get(payload.sub)
  if cached: return cached          # no toca la base de datos
  user = db.findById(payload.sub)
  if !user or !user.isActive: throw Unauthorized
  authenticatedUser = { id, username, nombre, role, mustChangePassword }
  redisUserCache.set(authenticatedUser, ttl=5min)   # TTL < duración del access token (15min)
  return authenticatedUser
```

Punto clave: el **TTL del cache es menor que la duración del access token**. Así, cualquier cambio de rol/estado del usuario (desactivación, cambio de permisos) se refleja como máximo 5 minutos después, sin depender de que el usuario vuelva a loguearse. El cache debe invalidarse explícitamente (borrar la key) en cualquier mutación del usuario: cambio de rol, desactivación, cambio de contraseña, etc.

El objeto devuelto por `validate()` es lo que Passport adjunta a `request.user`, accesible luego vía un decorator `@CurrentUser()`.

### 2.11 Guards de autorización

- **JwtAuthGuard**: envoltorio simple de `AuthGuard('jwt')`, aplicado por ruta o controller con `@UseGuards()`.
- **RolesGuard**: lee metadata puesta por un decorator `@Roles('admin', 'x')` con `Reflector`, compara contra `request.user.role`. Se ejecuta **después** de `JwtAuthGuard` (necesita que `request.user` ya exista).
- **MustChangePasswordGuard**: si `request.user.mustChangePassword === true`, bloquea todas las rutas con `403` **excepto** las marcadas explícitamente con un decorator `@SkipMustChangePassword()` (típicamente solo el endpoint de "cambiar mi contraseña"). Esto obliga a que un usuario con password temporal no pueda usar el sistema hasta cambiarla, sin necesidad de chequear la condición manualmente en cada controller.

Los tres guards son independientes y se combinan por ruta/controller — ninguno está registrado global en `AppModule` en este proyecto (se aplican explícitamente donde corresponde), lo cual da control fino pero requiere disciplina de no olvidar aplicarlos en rutas nuevas. Una alternativa más segura por defecto para un sistema nuevo es registrar `JwtAuthGuard` como `APP_GUARD` global y usar un decorator `@Public()` para las pocas rutas que no lo requieran (login, health-check, etc.) — así "todo protegido por defecto" en vez de "todo abierto salvo lo marcado".

### 2.12 Auditoría

Cada intento de login (exitoso o fallido) escribe una fila en `AuditLog` con `action`, `username`/`userId`, `ipAddress`, `userAgent`, y un campo `details` JSON libre con la razón del fallo (`"Usuario no encontrado"`, `"Contraseña incorrecta"`, `"Usuario inactivo"`). Nunca se audita ni se loguea el password en texto plano.

### 2.13 Middlewares/seguridad globales (bootstrap del servidor)

Orden de aplicación en el arranque:

1. `compression()` — gzip de respuestas.
2. `helmet()` — headers de seguridad HTTP.
3. `cookie-parser` — necesario para leer la cookie del refresh token.
4. Filtro global de excepciones (respuestas de error uniformes).
5. `ValidationPipe` global con `whitelist: true, forbidNonWhitelisted: true, transform: true` — rechaza cualquier campo no declarado en el DTO, mitigando mass-assignment.
6. CORS restringido a un único origen (`FRONTEND_URL`) con `credentials: true` (imprescindible para que el navegador mande la cookie httpOnly en requests cross-origin).
7. Prefijo global de rutas (`/api`).

Validación de variables de entorno al boot con un schema (Joi u otro) que exige como mínimo: `JWT_SECRET` y `JWT_REFRESH_SECRET` con longitud mínima (32 chars), `DATABASE_URL`, `FRONTEND_URL`, host/puerto de Redis. Si falta alguna, el servidor no debe arrancar.

---

## 3. Frontend

### 3.1 Tipos (contrato con el backend)

```typescript
LoginCredentials  = { username, password }
LoginResponse     = { accessToken, mustChangePassword, user }
RefreshResponse   = { accessToken }
```

### 3.2 Cliente HTTP (axios) con interceptores

**Instancia base**: `withCredentials: true` (obligatorio para que la cookie del refresh token viaje) + `baseURL` desde variable de entorno.

**Interceptor de request**: lee el access token de `localStorage` y lo adjunta como `Authorization: Bearer <token>` si existe.

**Interceptor de response** (el más delicado — patrón a replicar tal cual):

1. Si la respuesta es `403` con el mensaje específico de "debe cambiar contraseña": limpiar sesión local y redirigir a `/login` de inmediato (no intentar refresh).
2. Si es `401` y la request **no** es ya un retry, y la URL **no** es `/auth/login` ni `/auth/refresh` (evita loop infinito de refresh-sobre-refresh):
   - Si ya hay un refresh en curso (`isRefreshing`), **encolar** la request en `failedQueue` en vez de disparar otro refresh en paralelo — evita múltiples llamadas simultáneas a `/auth/refresh` cuando varias requests fallan a la vez.
   - Si no, marcar `isRefreshing = true`, llamar a `/auth/refresh`, guardar el nuevo access token, reintentar la request original y **liberar la cola** (`processQueue`) con el nuevo token para todas las requests que esperaban.
   - Si el refresh también falla: limpiar sesión local y redirigir a `/login`.

Este patrón de cola (`failedQueue` + flag `isRefreshing`) es el punto más fácil de omitir al replicar el sistema, pero es el que evita condiciones de carrera cuando 3-4 requests fallan por token expirado al mismo tiempo.

### 3.3 Store global de auth (Zustand o equivalente)

Estado: `user, accessToken, isAuthenticated, isLoading, error, mustChangePassword`.

- `accessToken` y `user` se persisten en `localStorage` (no en el store en memoria solamente) para sobrevivir a un refresh de página; se rehidratan al montar la app vía una acción `checkAuth()`.
- El **refresh token nunca pasa por el store ni por localStorage** — vive solo en la cookie httpOnly, invisible para JS.
- `login()` llama al service, guarda `user + accessToken + mustChangePassword`.
- `logout()` llama al endpoint de logout (best-effort — si falla igual limpia el estado local) y limpia `localStorage` + estado.
- `refreshAccessToken()` expuesto para uso manual si se necesita fuera del interceptor de axios.

### 3.4 Rutas protegidas (React Router)

Dos wrappers que envuelven grupos de `<Route>`:

- **`ProtectedRoute({ allowedRoles })`**:
  1. Si `isLoading` → spinner.
  2. Si `!isAuthenticated` → redirect a `/login`.
  3. Si `allowedRoles` definido y el rol del usuario no está incluido → redirect a la home de **su** rol (no a login — ya está autenticado, solo no tiene permiso ahí).
  4. Si `mustChangePassword` → renderizar un modal bloqueante de cambio de contraseña en vez del `<Outlet />`.
  5. Si todo OK → `<Outlet />`.

- **`PublicRoute()`** (para `/login`): si el usuario ya está autenticado, redirige directo a la home de su rol — evita que un usuario logueado vea el formulario de login de nuevo.

Mapeo de rol → ruta home centralizado en un solo lugar (diccionario `{ admin: '/admin', ... }`), usado tanto en el redirect post-login como en `PublicRoute`/`ProtectedRoute`, para no duplicar esa lógica.

### 3.5 Página de login

Responsabilidades del componente, más allá del formulario:
- Deshabilitar el submit mientras `isLoading` o si hay un countdown de lockout activo.
- Parsear el mensaje de error del backend para detectar el patrón "en N segundos" (viene del `HttpException` de lockout) y mostrar un **countdown visual** en vez de solo el texto estático, decrementando cada segundo y limpiando el error al llegar a 0.
- `useEffect` que redirige automáticamente si el usuario ya quedó autenticado (cubre el caso de doble submit o navegación directa a `/login` estando ya logueado).

---

## 4. Checklist para replicar en otro sistema

1. Modelo `User` con password hasheado (bcrypt, ≥10 rounds), `isActive`, `mustChangePassword`, relación a `Role`.
2. Tabla `RefreshToken` (token, userId, expiresAt, revoked, revokedAt, ipAddress, userAgent) — es lo que permite revocación real.
3. Tabla `AuditLog` para intentos de login.
4. Redis (u otro store compartido) para: contador de intentos fallidos + lockout, y cache del usuario autenticado con TTL menor al del access token.
5. Dos secrets JWT distintos (access/refresh), ambos ≥32 caracteres, validados al boot.
6. Endpoint login: valida lockout → busca usuario → compara password → limpia intentos → genera tokens → persiste refresh token → audita → responde. Mensajes de error genéricos que no revelen si el username existe.
7. Refresh token en **cookie httpOnly + Secure + SameSite=Strict**, scoped a la ruta de auth. Access token en el body de la respuesta, guardado client-side (localStorage o memoria) y enviado por header `Authorization`.
8. Endpoint refresh: valida JWT + valida que no esté revocado en DB + emite nuevo access token.
9. Endpoint logout: marca el refresh token como revocado en DB.
10. Passport/middleware de validación de access token con patrón cache-first (Redis) para no golpear DB en cada request.
11. Guards separados y componibles: autenticación, rol, "debe cambiar password" — o, más seguro por defecto, un guard global + decorator `@Public()` para las excepciones.
12. Frontend: axios con interceptor de request (adjunta token) y de response (maneja 401 con refresh automático + cola para requests concurrentes, evita loop sobre `/login` y `/refresh`).
13. Store global persistiendo `user` + `accessToken` en localStorage, rehidratado al montar la app; refresh token nunca tocado por JS.
14. Rutas protegidas por autenticación + rol, con redirect inteligente (a login si no autenticado, a la home del propio rol si autenticado pero sin permiso).
15. Seguridad global del backend: `helmet`, CORS restringido con `credentials: true`, `ValidationPipe`/equivalente con whitelist estricta, validación de env vars al boot.

---

## 5. Decisiones de diseño a tener en cuenta (trade-offs)

- **Sin blacklist de access tokens**: logout no invalida el access token en curso, solo el refresh. Ventana de hasta la duración del access token (15 min en este proyecto) donde un token robado post-logout sigue funcionando. Aceptable si el access token es de vida corta; si se necesita revocación inmediata, agregar blacklist en Redis consultada en cada request (cuesta performance).
- **Refresh token no rotativo**: se reusa el mismo refresh token hasta su expiración natural (7 días), solo se emite nuevo access token. Una variante más estricta (rotación de refresh token en cada uso, con detección de reuso) da más seguridad pero más complejidad.
- **Dos capas de rate-limiting redundantes** (lockout por username en Redis + throttler por IP): son complementarias, no una reemplaza a la otra.
- **Guards aplicados por ruta, no global**: da flexibilidad pero depende de no olvidar `@UseGuards()` en endpoints nuevos — el patrón "todo protegido salvo `@Public()`" es más seguro por defecto para un sistema nuevo.
