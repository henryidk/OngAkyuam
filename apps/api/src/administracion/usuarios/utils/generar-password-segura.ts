import { randomInt } from 'crypto';

const MAYUSCULAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MINUSCULAS = 'abcdefghijklmnopqrstuvwxyz';
const DIGITOS = '0123456789';
const ESPECIALES = '!@#$%&*';
const TODOS = MAYUSCULAS + MINUSCULAS + DIGITOS + ESPECIALES;

/**
 * Contraseña temporal para crear/resetear cuentas desde Administración. Usa `randomInt`
 * (CSPRNG de Node, no `Math.random`) y garantiza un carácter de cada clase antes de
 * rellenar el resto al azar, para que nunca dependa de la suerte cumplir la política de
 * complejidad. El orden final se mezcla (Fisher-Yates) para no dejar las 4 primeras
 * posiciones siempre con el mismo patrón de clase.
 */
export function generarPasswordSegura(): string {
  const password: string[] = [
    MAYUSCULAS[randomInt(MAYUSCULAS.length)],
    MINUSCULAS[randomInt(MINUSCULAS.length)],
    DIGITOS[randomInt(DIGITOS.length)],
    ESPECIALES[randomInt(ESPECIALES.length)],
    TODOS[randomInt(TODOS.length)],
    TODOS[randomInt(TODOS.length)],
    TODOS[randomInt(TODOS.length)],
    TODOS[randomInt(TODOS.length)],
  ];

  for (let i = password.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join('');
}
