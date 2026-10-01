import type {
  AccionProceso,
  FaseProcesoJuridico,
  SituacionProcesoJuridico,
} from '@akyuam/shared';

export interface EstadoProceso {
  fase: FaseProcesoJuridico;
  situacion: SituacionProcesoJuridico;
}

/**
 * Qué se le puede hacer a un proceso según sus dos ejes (fase = cuánto avanzó, situación = si
 * se está trabajando). Es la única copia de estas reglas: el frontend recibe
 * `accionesDisponibles` ya calculado y nunca las reimplementa. Sin Nest ni Prisma a propósito.
 */
const REGLAS: Record<AccionProceso, (estado: EstadoProceso) => boolean> = {
  AVANZAR: (e) => e.fase === 'INICIADO' && e.situacion === 'ACTIVO',
  FINALIZAR: (e) => e.fase !== 'FINALIZADO' && e.situacion === 'ACTIVO',
  SUSPENDER: (e) => e.fase !== 'FINALIZADO' && e.situacion === 'ACTIVO',
  ABANDONAR: (e) => e.fase !== 'FINALIZADO' && e.situacion !== 'ABANDONADO',
  REACTIVAR: (e) => e.situacion !== 'ACTIVO',
};

export function puedeAplicar(
  accion: AccionProceso,
  estado: EstadoProceso,
): boolean {
  return REGLAS[accion](estado);
}

export function accionesDisponibles(estado: EstadoProceso): AccionProceso[] {
  return (Object.keys(REGLAS) as AccionProceso[]).filter((accion) =>
    REGLAS[accion](estado),
  );
}
