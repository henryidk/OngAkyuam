import type { ProcesoResumen } from '@akyuam/shared'

export interface OtrosProcesosAgrupados {
  abiertos: ProcesoResumen[]
  cerrados: ProcesoResumen[]
}

function estaCerrado(proceso: ProcesoResumen): boolean {
  return proceso.estadoVisible === 'FINALIZADO' || proceso.estadoVisible === 'ABANDONADO'
}

/** Lo que pide atención primero; luego lo trabajado más recientemente. */
function ordenarAbiertos(a: ProcesoResumen, b: ProcesoResumen): number {
  if (a.requiereAtencion !== b.requiereAtencion) return a.requiereAtencion ? -1 : 1
  return b.ultimaActuacionEn.localeCompare(a.ultimaActuacionEn)
}

/** El cerrado más recientemente primero. */
function ordenarCerrados(a: ProcesoResumen, b: ProcesoResumen): number {
  return (b.fechaCierre ?? '').localeCompare(a.fechaCierre ?? '')
}

/** Separa en curso (en trámite o suspendidos) de cerrados (finalizados o abandonados). */
export function agruparOtrosProcesos(procesos: ProcesoResumen[]): OtrosProcesosAgrupados {
  return {
    abiertos: procesos.filter((proceso) => !estaCerrado(proceso)).sort(ordenarAbiertos),
    cerrados: procesos.filter(estaCerrado).sort(ordenarCerrados),
  }
}
