import { Prisma } from '@prisma/client';
import { HorarioOcupadoError } from '../interfaces/errores-medica';

const INTENTOS_MAXIMOS = 3;

// P2034: Postgres abortó la transacción serializable por un conflicto con otra simultánea.
// P2002: chocó con un índice único por la misma carrera (dos atenciones activas, la misma
// persona registrada dos veces); `esChoqueTraslape`, dos citas traslapadas. Repetirla es seguro: la segunda vuelta ya ve lo que escribió la otra y
// responde con el error de negocio que corresponde.
const CODIGOS_REINTENTABLES = ['P2002', 'P2034'];

function esReintentable(error: unknown): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      CODIGOS_REINTENTABLES.includes(error.code)) ||
    esChoqueTraslape(error)
  );
}

/**
 * Restricción de exclusión que impide dos citas vigentes traslapadas (migración
 * medica_citas_familiares). Prisma no tiene código propio para una violación de exclusión
 * (Postgres 23P01): llega como error desconocido con el nombre de la restricción en el mensaje.
 */
const RESTRICCION_TRASLAPE = 'CitaMedica_sin_traslape_excl';

/** El error es el choque de dos citas traslapadas (la misma carrera que un `P2002`). */
export function esChoqueTraslape(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientUnknownRequestError &&
    error.message.includes(RESTRICCION_TRASLAPE)
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

/**
 * `conReintentos` para transacciones que crean citas: si tras los reintentos sigue chocando con
 * la restricción de exclusión, otra petición tomó un horario traslapado en el mismo instante.
 */
export async function conReintentosHorario<T>(
  operacion: () => Promise<T>,
): Promise<T> {
  try {
    return await conReintentos(operacion);
  } catch (error) {
    if (esChoqueTraslape(error)) {
      throw new HorarioOcupadoError();
    }
    throw error;
  }
}
