import type { Prisma } from '@prisma/client';
import {
  etiquetaProceso,
  fechaCalendarioGT,
  horaGT,
  type AudienciaDetalleDto,
  type AudienciaEnlazadaDto,
  type AudienciaFilaDto,
} from '@akyuam/shared';
import { esProcesoActivo } from '../compartido/acceso-juridico';
import { estadoVisibleAudiencia } from '../dominio/estado-visible-audiencia';
import {
  accionesDisponiblesAudiencia,
  type EstadoAudienciaActual,
} from '../dominio/maquina-estado-audiencia';
import { INCLUDE_DOCUMENTO, mapearDocumento } from './mapeo-documento';
import { nombreCompleto } from './mapeo-proceso';

const SELECT_ENLAZADA = {
  select: { id: true, inicio: true },
} satisfies Prisma.AudienciaJuridicaDefaultArgs;

export const INCLUDE_FILA_AUDIENCIA = {
  responsable: { select: { id: true, nombre: true } },
  // Solo para saber si ya tiene nueva fecha (acción "Agendar nueva fecha").
  reprogramadaA: SELECT_ENLAZADA,
  proceso: {
    select: {
      tipo: true,
      consecutivo: true,
      numeroJudicial: true,
      fase: true,
      situacion: true,
      expediente: {
        select: {
          numero: true,
          usuaria: { select: { id: true, nombres: true, apellidos: true } },
        },
      },
    },
  },
} satisfies Prisma.AudienciaJuridicaInclude;

export const INCLUDE_DETALLE_AUDIENCIA = {
  ...INCLUDE_FILA_AUDIENCIA,
  reprogramadaDesde: SELECT_ENLAZADA,
  documentos: {
    include: INCLUDE_DOCUMENTO,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  },
} satisfies Prisma.AudienciaJuridicaInclude;

type AudienciaConFila = Prisma.AudienciaJuridicaGetPayload<{
  include: typeof INCLUDE_FILA_AUDIENCIA;
}>;

type AudienciaConDetalle = Prisma.AudienciaJuridicaGetPayload<{
  include: typeof INCLUDE_DETALLE_AUDIENCIA;
}>;

/** Lo que la máquina de estados necesita de una fila ya leída. */
export function estadoActualAudiencia(audiencia: {
  estado: AudienciaConFila['estado'];
  inicio: Date;
  reprogramadaA: { id: string } | null;
  proceso: Pick<AudienciaConFila['proceso'], 'fase' | 'situacion'>;
}): EstadoAudienciaActual {
  return {
    estado: audiencia.estado,
    inicio: audiencia.inicio,
    tieneNuevaFecha: audiencia.reprogramadaA !== null,
    procesoAbierto: esProcesoActivo(audiencia.proceso),
  };
}

function enlazada(
  audiencia: { id: string; inicio: Date } | null,
): AudienciaEnlazadaDto | null {
  return audiencia
    ? {
        id: audiencia.id,
        fecha: fechaCalendarioGT(audiencia.inicio),
        hora: horaGT(audiencia.inicio),
      }
    : null;
}

/** Fecha y hora salen del mismo instante, ya en Guatemala: nunca pueden contradecirse. */
export function mapearFilaAudiencia(
  audiencia: AudienciaConFila,
  ahora: Date,
): AudienciaFilaDto {
  const { proceso } = audiencia;
  return {
    id: audiencia.id,
    procesoId: audiencia.procesoId,
    codigoProceso: etiquetaProceso(
      proceso.expediente.numero,
      proceso.consecutivo,
    ),
    expedienteNumero: proceso.expediente.numero,
    tipoProceso: proceso.tipo,
    usuaria: {
      id: proceso.expediente.usuaria.id,
      nombreCompleto: nombreCompleto(proceso.expediente.usuaria),
    },
    numeroJudicial: proceso.numeroJudicial,
    inicio: audiencia.inicio.toISOString(),
    fecha: fechaCalendarioGT(audiencia.inicio),
    hora: horaGT(audiencia.inicio),
    responsable: audiencia.responsable,
    estado: audiencia.estado,
    estadoVisible: estadoVisibleAudiencia(
      audiencia.estado,
      audiencia.inicio,
      ahora,
    ),
    descripcion: audiencia.descripcion,
    origenCancelacion: audiencia.origenCancelacion,
    accionesDisponibles: accionesDisponiblesAudiencia(
      estadoActualAudiencia(audiencia),
      ahora,
    ),
    version: audiencia.version,
  };
}

export function mapearDetalleAudiencia(
  audiencia: AudienciaConDetalle,
  ahora: Date,
): AudienciaDetalleDto {
  return {
    ...mapearFilaAudiencia(audiencia, ahora),
    observaciones: audiencia.observaciones,
    motivo: audiencia.motivo,
    reprogramadaDesde: enlazada(audiencia.reprogramadaDesde),
    reprogramadaA: enlazada(audiencia.reprogramadaA),
    resultadoEn: audiencia.resultadoEn?.toISOString() ?? null,
    documentos: audiencia.documentos.map(mapearDocumento),
  };
}
