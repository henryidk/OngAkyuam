import type { Prisma } from '@prisma/client';
import { DURACION_CITA_MEDICA_MIN } from '@akyuam/shared';
import { HorarioOcupadoError } from '../interfaces/errores-medica';

export interface CrearCitaEnTx {
  atencionId: string;
  ninoId: string | null;
  inicio: Date;
  creadoPorId: string;
  reprogramadaDesdeId?: string;
}

/**
 * Crea una cita dentro de una transacción ya abierta. La comparten programar, reprogramar y la
 * "próxima consulta" del registro, para que las tres validen el horario igual. El índice parcial
 * `CitaMedica_horario_uq` respalda la comprobación ante dos peticiones simultáneas.
 */
export async function crearCitaEnTx(
  tx: Prisma.TransactionClient,
  params: CrearCitaEnTx,
): Promise<string> {
  const ocupada = await tx.citaMedica.findFirst({
    where: {
      inicio: params.inicio,
      estado: { in: ['PROGRAMADA', 'ATENDIDA'] },
    },
    select: { id: true },
  });
  if (ocupada) {
    throw new HorarioOcupadoError();
  }
  const cita = await tx.citaMedica.create({
    data: {
      atencionId: params.atencionId,
      ninoId: params.ninoId,
      inicio: params.inicio,
      duracionMin: DURACION_CITA_MEDICA_MIN,
      reprogramadaDesdeId: params.reprogramadaDesdeId ?? null,
      creadoPorId: params.creadoPorId,
    },
    select: { id: true },
  });
  return cita.id;
}

/** Una fecha de calendario "YYYY-MM-DD" como valor de columna `@db.Date` (medianoche UTC). */
export function columnaFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}
