import { formatInstanteGT, type ProcesoPsicologiaResumen } from '@akyuam/shared'
import { fechaDeInstante } from '../../../lib/formato'

/** "3 sesiones" / "1 sesión" / "Sin sesiones". */
export function textoSesiones(proceso: ProcesoPsicologiaResumen): string {
  if (proceso.sesionesAtendidas === 0) return 'Sin sesiones'
  return proceso.sesionesAtendidas === 1 ? '1 sesión' : `${proceso.sesionesAtendidas} sesiones`
}

/** Lo que sigue en el proceso: su cierre, su próxima cita o que se quedó sin fecha. */
export function textoSiguiente(proceso: ProcesoPsicologiaResumen): string {
  if (proceso.fechaCierre) return `Cerrado ${fechaDeInstante(proceso.fechaCierre)}`
  if (!proceso.proximaCita) return 'Sin próxima cita'
  return `Próxima cita ${formatInstanteGT(proceso.proximaCita.fechaHora)}`
}
