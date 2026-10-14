import { randomBytes } from 'node:crypto';

/**
 * Entorno de las pruebas E2E. Corren contra una base y un Redis propios, nunca los de desarrollo
 * ni producción: solo se aceptan `E2E_DATABASE_URL` (base cuyo nombre termina en `_e2e`) y
 * `E2E_REDIS_URL`. Se definen todas las variables que valida `env.schema.ts`, para que nada se
 * tome del `.env` local (process.env tiene prioridad sobre el archivo). Los secretos JWT se
 * generan en cada corrida y R2 recibe valores falsos: ninguna prueba sube ni firma archivos.
 */
const baseDatos = process.env.E2E_DATABASE_URL;
const redis = process.env.E2E_REDIS_URL;

if (!baseDatos || !redis) {
  throw new Error(
    'Las pruebas E2E necesitan E2E_DATABASE_URL y E2E_REDIS_URL (ver test/e2e/README.md).',
  );
}
if (!new URL(baseDatos).pathname.endsWith('_e2e')) {
  throw new Error(
    'E2E_DATABASE_URL debe apuntar a una base exclusiva de pruebas, cuyo nombre termine en "_e2e".',
  );
}

Object.assign(process.env, {
  NODE_ENV: 'test',
  TZ: 'UTC',
  DATABASE_URL: baseDatos,
  REDIS_URL: redis,
  JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
  JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
  FRONTEND_URL: 'http://localhost:5173',
  R2_ACCESS_KEY_ID: 'e2e-sin-r2',
  R2_SECRET_ACCESS_KEY: 'e2e-sin-r2',
  R2_ENDPOINT: 'http://127.0.0.1:9',
  R2_BUCKET_NAME: 'e2e-sin-r2',
});
