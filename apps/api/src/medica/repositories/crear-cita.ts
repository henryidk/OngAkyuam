import type { Prisma } from '@prisma/client';
import { HorarioOcupadoError } from '../interfaces/errores-medica';
import { finCita } from '../dominio/horario';

export interface CrearCitaEnTx {
  atencionId: string;
  /** Personas de la visita: null = la usuaria, un id = un hijo/a. Ya validadas por el servicio. */
  personas: (string | null)[];
  inicio: Date;
  duracionMin: number;
  creadoPorId: string;
  reprogramadaDesdeId?: string;
}

/** La cita más larga posible: acota la búsqueda de citas que empezaron antes y aún no terminan. */
const DURACION_MAXIMA_MIN = 90;

/**
 * Crea una cita con sus personas dentro de una transacción ya abierta. La comparten programar,
 * reprogramar y la "próxima consulta" del registro, para que las tres validen el horario igual
 * (mover una cita futura usa `exigirHorarioLibre` directamente).
 * La restricción de exclusión `CitaMedica_sin_traslape_excl` respalda la comprobación ante dos
 * peticiones simultáneas.
 */
export async function crearCitaEnTx(
  tx: Prisma.TransactionClient,
  params: CrearCitaEnTx,
): Promise<string> {
  await exigirHorarioLibre(tx, params.inicio, params.duracionMin);
  const cita = await tx.citaMedica.create({
    data: {
      atencionId: params.atencionId,
      inicio: params.inicio,
      duracionMin: params.duracionMin,
      reprogramadaDesdeId: params.reprogramadaDesdeId ?? null,
      creadoPorId: params.creadoPorId,
      personas: {
        create: params.personas.map((ninoId) => ({ ninoId })),
      },
    },
    select: { id: true },
  });
  return cita.id;
}

/**
 * Lanza `HorarioOcupadoError` si [inicio, fin) se cruza con otra cita programada o atendida.
 * `excluirCitaId` deja fuera a la propia cita cuando se mueve de horario.
 */
export async function exigirHorarioLibre(
  tx: Prisma.TransactionClient,
  inicio: Date,
  duracionMin: number,
  excluirCitaId?: string,
): Promise<void> {
  const fin = finCita(inicio, duracionMin);
  // Prisma no calcula el fin de otra fila en el WHERE: se traen las que empiezan dentro de la
  // ventana posible y se comparan los rangos [inicio, fin) aquí.
  const cercanas = await tx.citaMedica.findMany({
    where: {
      inicio: {
        gt: new Date(inicio.getTime() - DURACION_MAXIMA_MIN * 60_000),
        lt: fin,
      },
      estado: { in: ['PROGRAMADA', 'ATENDIDA'] },
      ...(excluirCitaId ? { id: { not: excluirCitaId } } : {}),
    },
    select: { inicio: true, duracionMin: true },
  });
  const traslapa = cercanas.some(
    (cita) =>
      cita.inicio.getTime() < fin.getTime() &&
      finCita(cita.inicio, cita.duracionMin).getTime() > inicio.getTime(),
  );
  if (traslapa) {
    throw new HorarioOcupadoError();
  }
}

/** Una fecha de calendario "YYYY-MM-DD" como valor de columna `@db.Date` (medianoche UTC). */
export function columnaFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}
