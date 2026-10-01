import type { Prisma } from '@prisma/client';
import { fechaColumnaISO, type ProcesoResumen } from '@akyuam/shared';
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
