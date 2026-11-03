import { Prisma } from '@prisma/client';
import { consecutivoTrasMaximo } from '../../common/consecutivo';

const INTENTOS_MAXIMOS = 3;

// P2034: Postgres abortó la transacción serializable por un conflicto con otra simultánea.
// P2002: chocó con un índice único por la misma carrera. Repetirla es seguro: la segunda vuelta
// ya ve lo que escribió la otra y responde con el error de negocio que corresponde.
const CODIGOS_REINTENTABLES = ['P2002', 'P2034'];

export function esReintentable(error: unknown): boolean {
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

/**
 * Siguiente número de proceso de la persona: la usuaria en este expediente, o el hijo/a en su
 * enlace con el expediente. Es la única regla de numeración de Psicología: la usan tomar el
 * caso y abrir un proceso, y la vista previa del código usa `consecutivoSiguiente` sobre los
 * mismos procesos. Debe llamarse con el expediente bloqueado (`FOR UPDATE`) o dentro de una
 * transacción serializable.
 */
export async function siguienteConsecutivoProceso(
  tx: Prisma.TransactionClient,
  expedienteId: string,
  ninoId: string | null,
): Promise<number> {
  const ultimo = await tx.atencionPsicologica.aggregate({
    where: ninoId === null ? { expedienteId, ninoId: null } : { ninoId },
    _max: { consecutivo: true },
  });
  return consecutivoTrasMaximo(ultimo._max.consecutivo);
}
