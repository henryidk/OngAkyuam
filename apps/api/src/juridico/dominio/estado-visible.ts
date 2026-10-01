import {
  DIAS_ALERTA_INACTIVIDAD,
  type EstadoVisibleProceso,
} from '@akyuam/shared';
import type { EstadoProceso } from './maquina-estado-proceso';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** La etiqueta de color que ve el personal. Finalizado gana sobre cualquier situación. */
export function estadoVisible(estado: EstadoProceso): EstadoVisibleProceso {
  if (estado.fase === 'FINALIZADO') return 'FINALIZADO';
  if (estado.situacion === 'SUSPENDIDO') return 'SUSPENDIDO';
  if (estado.situacion === 'ABANDONADO') return 'ABANDONADO';
  return 'EN_TRAMITE';
}

/** Instante a partir del cual un proceso sin actuaciones se considera desatendido. */
export function limiteInactividad(ahora: Date = new Date()): Date {
  return new Date(ahora.getTime() - DIAS_ALERTA_INACTIVIDAD * MS_POR_DIA);
}

/** Proceso en trámite que lleva más de `DIAS_ALERTA_INACTIVIDAD` días sin ninguna actuación. */
export function requiereAtencion(
  estado: EstadoProceso,
  ultimaActuacionEn: Date,
  ahora: Date = new Date(),
): boolean {
  return (
    estadoVisible(estado) === 'EN_TRAMITE' &&
    ultimaActuacionEn < limiteInactividad(ahora)
  );
}
