import type { Prisma } from '@prisma/client';
import { etiquetaAtencion, fechaCalendarioGT, horaGT } from '@akyuam/shared';
import type { ConsultaMedicaDto } from '@akyuam/shared';
import {
  SELECT_PERSONA,
  personaAtendida,
} from '../../psicologia/repositories/personas';
import { SELECT_SIGNOS, signosDeFila } from './mapeo';

/**
 * La consulta completa, con su contenido clínico. Es el único lugar que decide qué columnas
 * clínicas salen de la base: lo comparten la historia clínica y el detalle del historial.
 */
export const SELECT_CONSULTA = {
  id: true,
  atencionId: true,
  citaId: true,
  fechaHora: true,
  motivoConsulta: true,
  diagnostico: true,
  planTratamiento: true,
  recetaLaboratorios: true,
  ...SELECT_SIGNOS,
  nino: { select: { id: true, ...SELECT_PERSONA } },
  atencion: {
    select: {
      consecutivo: true,
      expediente: {
        select: { numero: true, usuaria: { select: SELECT_PERSONA } },
      },
    },
  },
  documentos: {
    select: {
      id: true,
      nombreVisible: true,
      nombreArchivo: true,
      mimeType: true,
      tamanioBytes: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ConsultaMedicaSelect;

export type FilaConsulta = Prisma.ConsultaMedicaGetPayload<{
  select: typeof SELECT_CONSULTA;
}>;

export function aConsultaDto(fila: FilaConsulta): ConsultaMedicaDto {
  const persona = personaAtendida(fila.atencion.expediente.usuaria, fila.nino);
  const fecha = fechaCalendarioGT(fila.fechaHora);
  return {
    id: fila.id,
    atencionId: fila.atencionId,
    codigoAtencion: etiquetaAtencion(
      fila.atencion.expediente.numero,
      fila.atencion.consecutivo,
    ),
    citaId: fila.citaId,
    fechaHora: fila.fechaHora.toISOString(),
    fecha,
    hora: horaGT(fila.fechaHora),
    persona,
    motivoConsulta: fila.motivoConsulta,
    diagnostico: fila.diagnostico,
    planTratamiento: fila.planTratamiento,
    recetaLaboratorios: fila.recetaLaboratorios,
    signos: signosDeFila(fila),
    documentos: fila.documentos.map((documento) => ({
      ...documento,
      consultaId: fila.id,
      createdAt: documento.createdAt.toISOString(),
      fechaConsulta: fecha,
      personaNombre: persona.nombreCompleto,
    })),
  };
}
