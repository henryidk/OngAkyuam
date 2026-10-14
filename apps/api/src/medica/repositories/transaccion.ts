import { Prisma } from '@prisma/client';

const INTENTOS_MAXIMOS = 3;

// P2034: Postgres abortó la transacción serializable por un conflicto con otra simultánea.
// P2002: chocó con un índice único por la misma carrera (dos citas al mismo horario, dos
// atenciones activas). Repetirla es seguro: la segunda vuelta ya ve lo que escribió la otra y
// responde con el error de negocio que corresponde.
const CODIGOS_REINTENTABLES = ['P2002', 'P2034'];

function esReintentable(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    CODIGOS_REINTENTABLES.includes(error.code)
  );
}

export const SERIALIZABLE = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
};

/** Ejecuta una transacción serializable y la repite ante una carrera con otra petición. */
export async function conReintentos<T>(
  operacion: () => Promise<T>,
): Promise<T> {
  for (let intento = 1; ; intento += 1) {
    try {
      return await operacion();
    } catch (error) {
      if (intento >= INTENTOS_MAXIMOS || !esReintentable(error)) {
        throw error;
      }
    }
  }
}

/** El error de Prisma es un choque con un índice único (`P2002`). */
export function esChoqueUnico(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
