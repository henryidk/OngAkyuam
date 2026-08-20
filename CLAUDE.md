# AKyuam — contexto del proyecto

## Idioma

Responder siempre en español — todos los mensajes, explicaciones y resúmenes de esta conversación, sin excepción.

## Qué es

Sistema de gestión de casos para una ONG que atiende a **sobrevivientes de violencia**. Datos altamente sensibles — trátalos siempre con ese nivel de cuidado (privacidad, exposición mínima, nunca en logs ni en el repo).

## Flujo de trabajo (dominio)

1. **Gerencia** registra información rápida de la usuaria que busca ayuda.
2. El caso pasa a **trabajo social**: hacen entrevistas, llenan documentos en papel (esto sigue siendo así) y capturan información rápida en formularios digitales. Los documentos físicos se escanean y se suben al sistema.
3. Trabajo social refiere el caso a una o varias áreas: **jurídica**, **psicológica**, **médica** (cada una atiende distinto).
4. Cada área solo ve lo que trabajo social le autoriza explícitamente: los datos del formulario digital, y los archivos subidos **solo si** trabajo social habilitó visibilidad para esa área en particular. Todo es privado por defecto.
5. Es un solo sistema conectado (una SPA), no sistemas separados por área — cada área tiene su propio módulo/vistas dentro de la misma app, con el mismo login y el mismo backend.

Hay más matices del flujo real que no se han cubierto todavía — preguntar antes de asumir reglas de negocio no confirmadas.

## Stack decidido (con motivo, no por defecto)

- **Backend: NestJS + TypeScript.** Ya decidido por el usuario.
- **Base de datos: PostgreSQL**, idealmente DigitalOcean Managed Database (backups automáticos / point-in-time recovery — justificado por la sensibilidad del dato, no por buena práctica genérica).
- **ORM: Prisma.**
- **Autorización: en la capa de aplicación (Guards/servicios de NestJS)**, no Row Level Security de Postgres. Motivo: Prisma + RLS tiene fricción real (RLS necesita `SET LOCAL` por request, incómodo con el pool de conexiones de Prisma). Se prioriza velocidad y testeabilidad para un equipo chico. Modelo: tabla `permisos_area` (caso_id, area_id, otorgado_por) + tabla `audit_log` para cada lectura/escritura sensible.
- **Modelo de datos**: tablas núcleo rígidas (casos, usuarias, areas, referidos, documentos, permisos_area, audit_log) + columna **JSONB** para el contenido específico de cada formulario por área, validada con **Zod** — porque cada área maneja formularios distintos y van a seguir cambiando; evita migraciones constantes.
- **Auth**: Passport + JWT en cookie `httpOnly/secure/sameSite` (no localStorage, para evitar robo de token vía XSS) + CSRF.
- **Archivos: Cloudflare R2.** Nunca acceso directo — el backend emite URLs firmadas de corta duración solo tras validar el permiso del área sobre ese caso/documento.
- **Frontend: React + Vite + TypeScript + Tailwind + React Router + React Hook Form + Zod.** Se prefirió Vite sobre Next.js porque es un panel interno autenticado sin necesidad de SEO/SSR — Next añadiría complejidad sin beneficio real aquí.
- **Validación compartida**: los mismos schemas de Zod (en `packages/shared`) validan el formulario en el navegador y el DTO en el backend — evita que ambos lados se desincronicen cuando un área cambia su formulario.
- **Monorepo: pnpm workspaces** — `apps/api`, `apps/web`, `packages/shared`.
- **Contenedores: Docker / docker-compose.**
- **Reverse proxy: nginx-proxy + acme-companion** (Nginx + TLS automático vía Let's Encrypt) — se prefirió sobre Caddy por ser más probado en producción a gran escala, dado que el usuario pidió explícitamente "lo más profesional y probado".
- **Hosting: DigitalOcean Droplet (VPS)** — decisión explícita del usuario, no App Platform.
- **DNS/borde: Cloudflare** (dominio comprado ahí, proxy activado, TLS modo *Full Strict*). El firewall de DigitalOcean debe restringirse para aceptar 80/443 solo desde los rangos de IP de Cloudflare; SSH restringido a IP conocida; UFW como respaldo.
- **Observabilidad**: pino (logs estructurados) + Sentry free tier para errores en producción — un fallo silencioso en un flujo de referido entre áreas puede significar que una sobreviviente no fue atendida, no es solo higiene técnica.

## Prioridad de testing

La lógica de autorización (quién puede ver qué caso/archivo) es la superficie de testing más importante del proyecto, por encima de cobertura general — un bug ahí es una violación de privacidad real para una sobreviviente, no un bug cosmético.

## Reglas de proceso — leer antes de tocar git o infraestructura

- **Nunca hacer `git commit` ni `git push` sin pedir confirmación explícita en ese momento**, incluso si parece obvio por el contexto de la conversación. El usuario ya tuvo que corregir esto una vez — no asumir autorización implícita nunca, ni siquiera para "solo el scaffold inicial". Preguntar primero, cada vez.
- **Ninguna contraseña ni credencial va nunca en un archivo expuesto/versionado, sin excepción** (docker-compose.yml, Dockerfiles, configs, ni siquiera como placeholder de desarrollo local). En la primera configuración de este proyecto se subió la contraseña de la base de datos directo en `docker-compose.yml` — esto se considera totalmente inseguro y no se repite bajo ninguna circunstancia, sin importar si el servicio está "solo en local" o "no expuesto a internet". Regla sin matices: toda contraseña/credencial se referencia vía variable de entorno desde un `.env` que esté en `.gitignore` desde el primer commit del repo (antes de crear cualquier otro archivo que pueda necesitarla), y se documenta el nombre de la variable (no el valor) en `.env.example`.
- **Disciplina de exposición de red** (aprendida de un incidente real en otro proyecto: un puerto de Redis quedó expuesto a internet y causó ataques): solo el reverse proxy publica puertos al host. Cualquier otro servicio (Postgres si se self-hostea, cachés futuros, paneles de administración) usa `expose` en Docker, nunca `ports`, y nunca se bindea a `0.0.0.0`. Firewall de la nube restringido a lo mínimo necesario, con UFW como segunda capa.
- **Nunca subir datos reales de usuarias/sobrevivientes al repositorio** — ni documentos escaneados, ni PDFs de ejemplo con datos reales, ni nada que parezca un formulario lleno. Si aparece un archivo así en el directorio de trabajo, señalarlo al usuario y no incluirlo en git sin confirmación explícita.
- Antes de cualquier acción irreversible o que afecte el repo remoto (merge de historiales no relacionados, resolución de conflictos, reescritura de historial), explicar el plan y esperar confirmación en vez de decidir unilateralmente.
- **Disciplina de migraciones de Prisma** (en un proyecto anterior con este usuario, saltarse migraciones un par de veces provocó que el esquema real de la base de datos se desincronizara del código, generando problemas que alargaron el trabajo para resolverlos después): cada vez que se modifique `schema.prisma`, generar y aplicar la migración correspondiente **en el mismo cambio** (`prisma migrate dev --name <algo descriptivo>`), nunca dejarlo pendiente "para después". Nunca editar la base de datos a mano ni con `prisma db push` como sustituto de una migración real en este proyecto. Al retomar el trabajo después de una pausa, correr `prisma migrate status` primero para confirmar que el esquema y las migraciones aplicadas siguen sincronizados antes de seguir programando encima.

## Estado actual

Este directorio contiene solo el contexto del proyecto (este archivo y `README.md`). El scaffolding del monorepo (NestJS, Vite, Prisma, Docker) se hizo una vez en una carpeta anterior y se descartó — el siguiente paso, cuando el usuario lo pida explícitamente, es rehacerlo aquí aplicando las reglas de proceso de arriba desde el principio.
