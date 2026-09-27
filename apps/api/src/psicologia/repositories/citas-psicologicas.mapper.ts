import type { Prisma } from '@prisma/client';
import type { CitaResumen, DocumentoCitaDto } from '@akyuam/shared';

/**
 * Solo el documento más reciente de la cita (normalmente hay a lo más uno, el Formato
 * General escaneado) — se usa en `CitaResumen.documento`, ver programarCitaSchema.
 */
export const INCLUDE_CITA = {
  atendidoPor: { select: { nombreCompleto: true } },
  documentos: { orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.CitaPsicologicaInclude;

type CitaConRelaciones = Prisma.CitaPsicologicaGetPayload<{
  include: typeof INCLUDE_CITA;
}>;

/**
 * Mapeo único de `CitaPsicologica` -> `CitaResumen`, reusado tanto por
 * `AtencionPsicologicaRepository` (historial dentro de una atención) como por
 * `CitasPsicologicasRepository` (agenda) — evita duplicar la forma del DTO en dos lugares.
 */
export function mapearCita(cita: CitaConRelaciones): CitaResumen {
  const primerDocumento = cita.documentos[0];
  const documento: DocumentoCitaDto | null = primerDocumento
    ? {
        id: primerDocumento.id,
        tipo: primerDocumento.tipo,
        nombreArchivo: primerDocumento.nombreArchivo,
        tamanioBytes: primerDocumento.tamanioBytes,
        createdAt: primerDocumento.createdAt.toISOString(),
      }
    : null;

  return {
    id: cita.id,
    fechaHora: cita.fechaHora.toISOString(),
    modalidad: cita.modalidad,
    lugar: cita.lugar,
    motivo: cita.motivo,
    tipo: cita.tipo,
    duracionMinutos: cita.duracionMinutos,
    estado: cita.estado,
    observaciones: cita.observaciones,
    acuerdos: cita.acuerdos,
    motivoNoAsistencia: cita.motivoNoAsistencia,
    temas: cita.temas,
    intervencion: cita.intervencion,
    recomendaciones: cita.recomendaciones,
    borrador: cita.borrador,
    reprogramadaDesdeId: cita.reprogramadaDesdeId,
    atendidoPor: cita.atendidoPor.nombreCompleto,
    documento,
  };
}
