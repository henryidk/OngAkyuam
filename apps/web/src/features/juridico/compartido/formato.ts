import { diasDesdeGT, formatFechaGT, type ProcesoResumen } from '@akyuam/shared'
import { fechaDeInstante, iniciales } from '../../../lib/formato'

export { fechaDeInstante, iniciales }

/** La fecha que más importa según el estado: el cierre si ya cerró, la última actuación si no. */
export function fechaDeReferencia(proceso: ProcesoResumen): string {
  if (proceso.fechaCierre) return `Cerrado ${formatFechaGT(proceso.fechaCierre)}`
  return `Últ. actuación ${fechaDeInstante(proceso.ultimaActuacionEn)}`
}

export function textoAlerta(proceso: ProcesoResumen): string | null {
  if (!proceso.requiereAtencion) return null
  return `${diasDesdeGT(proceso.ultimaActuacionEn)} días sin actuación`
}
