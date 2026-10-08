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

export function mapearDocumentoCita(
  documento:
    | {
        id: string;
        tipo: DocumentoCitaDto['tipo'];
        nombreArchivo: string;
        tamanioBytes: number;
        createdAt: Date;
      }
    | undefined,
): DocumentoCitaDto | null {
  if (!documento) {
    return null;
  }
  return {
    id: documento.id,
    tipo: documento.tipo,
    nombreArchivo: documento.nombreArchivo,
    tamanioBytes: documento.tamanioBytes,
    createdAt: documento.createdAt.toISOString(),
  };
}

/**
 * Mapeo único de `CitaPsicologica` -> `CitaResumen`, reusado tanto por
 * `AtencionPsicologicaRepository` (historial dentro de una atención) como por
 * `CitasPsicologicasRepository` (agenda) — evita duplicar la forma del DTO en dos lugares.
 */
export function mapearCita(cita: CitaConRelaciones): CitaResumen {
  const documento = mapearDocumentoCita(cita.documentos[0]);

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
