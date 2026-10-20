import type { Prisma } from '@prisma/client';
import {
  anioCalendarioGT,
  esDeSeguimiento,
  fechaCalendarioGT,
  fechaColumnaISO,
  horaGT,
  type ProcesoResumen,
  type ProximaAudienciaDto,
  etiquetaProceso,
} from '@akyuam/shared';
import type { PrismaService } from '../../prisma/prisma.service';
import { esProcesoActivo } from '../compartido/acceso-juridico';
import { estadoVisible, requiereAtencion } from '../dominio/estado-visible';
import { estadoVisibleAudiencia } from '../dominio/estado-visible-audiencia';

export const INCLUDE_RESUMEN = {
  abogada: { select: { id: true, nombre: true } },
  procuradora: { select: { id: true, nombre: true } },
  expediente: {
    select: {
      numero: true,
      usuaria: { select: { id: true, nombres: true, apellidos: true } },
    },
  },
  // La PROGRAMADA más antigua: la pendiente de resultado más vieja o, si no hay, la próxima
  // (§7.5). Prisma la trae en una consulta para todo el lote, sin N+1.
  audiencias: {
    where: { estado: 'PROGRAMADA' },
    orderBy: [{ inicio: 'asc' }, { id: 'asc' }],
    take: 1,
    select: { id: true, inicio: true },
  },
} satisfies Prisma.ProcesoJuridicoInclude;

export type ProcesoConResumen = Prisma.ProcesoJuridicoGetPayload<{
  include: typeof INCLUDE_RESUMEN;
}>;

export function nombreCompleto(usuaria: {
  nombres: string;
  apellidos: string;
}): string {
  return `${usuaria.nombres} ${usuaria.apellidos}`;
}

function proximaAudiencia(
  audiencia: { id: string; inicio: Date } | undefined,
  ahora: Date,
): ProximaAudienciaDto | null {
  if (!audiencia) {
    return null;
  }
  const estado = estadoVisibleAudiencia('PROGRAMADA', audiencia.inicio, ahora);
  return {
    id: audiencia.id,
    inicio: audiencia.inicio.toISOString(),
    fecha: fechaCalendarioGT(audiencia.inicio),
    hora: horaGT(audiencia.inicio),
    // Una PROGRAMADA solo puede verse como una de estas tres.
    estadoVisible: estado as ProximaAudienciaDto['estadoVisible'],
  };
}

/** Única traducción fila -> `ProcesoResumen`: lista, detalle, historial y asistente la comparten. */
export function mapearResumen(
  proceso: ProcesoConResumen,
  ahora: Date = new Date(),
): ProcesoResumen {
  const estado = { fase: proceso.fase, situacion: proceso.situacion };
  const fechaInicio = fechaColumnaISO(proceso.fechaInicio);
  return {
    id: proceso.id,
    codigo: etiquetaProceso(proceso.expediente.numero, proceso.consecutivo),
    expedienteId: proceso.expedienteId,
    expedienteNumero: proceso.expediente.numero,
    usuaria: {
      id: proceso.expediente.usuaria.id,
      nombreCompleto: nombreCompleto(proceso.expediente.usuaria),
    },
    tipo: proceso.tipo,
    fase: proceso.fase,
    situacion: proceso.situacion,
    estadoVisible: estadoVisible(estado),
    formaFinalizacion: proceso.formaFinalizacion,
    detalleFinalizacion: proceso.detalleFinalizacion,
    numeroJudicial: proceso.numeroJudicial,
    abogada: proceso.abogada,
    procuradora: proceso.procuradora,
    fechaInicio,
    fechaCierre: proceso.fechaCierre
      ? fechaColumnaISO(proceso.fechaCierre)
      : null,
    ultimaActuacionEn: proceso.ultimaActuacionEn.toISOString(),
    requiereAtencion: requiereAtencion(
      estado,
      proceso.ultimaActuacionEn,
      ahora,
    ),
    esSeguimiento: esDeSeguimiento(
      { fechaInicio, abierto: esProcesoActivo(proceso) },
      anioCalendarioGT(ahora),
    ),
    proximaAudiencia: proximaAudiencia(proceso.audiencias[0], ahora),
    version: proceso.version,
  };
}

/**
 * Carga y traduce los procesos de `ids` conservando su orden: las listas filtran y ordenan en
 * SQL crudo (el código "05-2026 · Proceso 2" no es una columna) y luego piden los datos por id.
 */
export async function cargarResumenes(
  prisma: PrismaService,
  ids: string[],
): Promise<ProcesoResumen[]> {
  if (ids.length === 0) {
    return [];
  }
  const procesos = await prisma.procesoJuridico.findMany({
    where: { id: { in: ids } },
    include: INCLUDE_RESUMEN,
  });
  const porId = new Map(procesos.map((proceso) => [proceso.id, proceso]));
  const ahora = new Date();
  return ids.flatMap((id) => {
    const proceso = porId.get(id);
    return proceso ? [mapearResumen(proceso, ahora)] : [];
  });
}
