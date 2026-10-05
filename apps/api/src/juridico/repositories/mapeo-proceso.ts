import type { Prisma } from '@prisma/client';
import { fechaColumnaISO, type ProcesoResumen } from '@akyuam/shared';
import type { PrismaService } from '../../prisma/prisma.service';
import { codigoProceso } from '../dominio/codigo-proceso';
import { estadoVisible, requiereAtencion } from '../dominio/estado-visible';

export const INCLUDE_RESUMEN = {
  abogada: { select: { id: true, nombre: true } },
  procuradora: { select: { id: true, nombre: true } },
  expediente: {
    select: {
      numero: true,
      usuaria: { select: { id: true, nombres: true, apellidos: true } },
    },
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

/** Única traducción fila -> `ProcesoResumen`: lista, detalle, historial y asistente la comparten. */
export function mapearResumen(
  proceso: ProcesoConResumen,
  ahora: Date = new Date(),
): ProcesoResumen {
  const estado = { fase: proceso.fase, situacion: proceso.situacion };
  return {
    id: proceso.id,
    codigo: codigoProceso(proceso.consecutivo, proceso.expediente.numero),
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
    fechaInicio: fechaColumnaISO(proceso.fechaInicio),
    fechaCierre: proceso.fechaCierre
      ? fechaColumnaISO(proceso.fechaCierre)
      : null,
    ultimaActuacionEn: proceso.ultimaActuacionEn.toISOString(),
    requiereAtencion: requiereAtencion(
      estado,
      proceso.ultimaActuacionEn,
      ahora,
    ),
    version: proceso.version,
  };
}

/**
 * Carga y traduce los procesos de `ids` conservando su orden: las listas filtran y ordenan en
 * SQL crudo (el código "J2-05-2026" no es una columna) y luego piden los datos por id.
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
