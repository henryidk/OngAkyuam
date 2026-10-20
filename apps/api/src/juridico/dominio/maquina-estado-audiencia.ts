import type { AccionAudiencia, EstadoAudiencia } from '@akyuam/shared';

export interface EstadoAudienciaActual {
  estado: EstadoAudiencia;
  inicio: Date;
  /** Ya tiene una fecha nueva enlazada (`reprogramadaA`): no se le agenda otra. */
  tieneNuevaFecha: boolean;
  /** El proceso está en trámite o suspendido (ni finalizado ni abandonado). */
  procesoAbierto: boolean;
}

type Regla = (audiencia: EstadoAudienciaActual, ahora: Date) => boolean;

const esProgramada: Regla = (a) => a.estado === 'PROGRAMADA';
const yaTieneResultado: Regla = (a) =>
  a.estado === 'REALIZADA' || a.estado === 'NO_REALIZADA';

/**
 * Qué se le puede hacer a una audiencia. Es la única copia de estas reglas: el frontend recibe
 * `accionesDisponibles` ya calculado y nunca las reimplementa. Sin Nest ni Prisma a propósito.
 *
 * Lo que mueve la agenda hacia adelante (reprogramar, cambiar responsable, agendar nueva fecha)
 * exige el proceso abierto. Lo que solo deja constancia de lo que ya pasó (cancelar, resultado,
 * observaciones, documentos) no: es historia de la usuaria aunque el proceso ya se cerró.
 */
const REGLAS: Record<AccionAudiencia, Regla> = {
  REPROGRAMAR: (a, ahora) => esProgramada(a, ahora) && a.procesoAbierto,
  CAMBIAR_RESPONSABLE: (a, ahora) => esProgramada(a, ahora) && a.procesoAbierto,
  CANCELAR: esProgramada,
  // El resultado se registra cuando la audiencia ya empezó, nunca antes.
  REGISTRAR_RESULTADO: (a, ahora) =>
    esProgramada(a, ahora) && a.inicio <= ahora,
  EDITAR_OBSERVACIONES: yaTieneResultado,
  // Citaciones y actas llegan antes o después de la fecha; una cancelada o reprogramada ya no
  // recibe documentos: van a la audiencia vigente.
  ADJUNTAR_DOCUMENTO: (a, ahora) =>
    esProgramada(a, ahora) || yaTieneResultado(a, ahora),
  AGENDAR_NUEVA_FECHA: (a) =>
    (a.estado === 'CANCELADA' || a.estado === 'NO_REALIZADA') &&
    !a.tieneNuevaFecha &&
    a.procesoAbierto,
};

export function puedeAplicarAudiencia(
  accion: AccionAudiencia,
  audiencia: EstadoAudienciaActual,
  ahora: Date,
): boolean {
  return REGLAS[accion](audiencia, ahora);
}

export function accionesDisponiblesAudiencia(
  audiencia: EstadoAudienciaActual,
  ahora: Date,
): AccionAudiencia[] {
  return (Object.keys(REGLAS) as AccionAudiencia[]).filter((accion) =>
    REGLAS[accion](audiencia, ahora),
  );
}
