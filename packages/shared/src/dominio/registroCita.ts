import { fechaCalendarioGT } from '../timezone.js'

/**
 * Cuándo se registra una cita (consulta médica o sesión psicológica). Una sola regla para las dos
 * áreas y para las dos pantallas que la ofrecen:
 *
 * - **Consultas › Por registrar** lista la cita programada que ya empezó (en curso o terminada sin
 *   registro): es lo pendiente de cerrar.
 * - **Agenda** ofrece además registrar la cita de hoy que todavía no empieza (la persona llegó
 *   antes). Una cita de otro día futuro no se registra desde las pantallas: se reprograma.
 *
 * El backend no la exige a propósito (decisión del usuario, 2026-11-07): deja la puerta abierta
 * para un caso excepcional. La consulta sin cita no pasa por aquí: se registra cualquier día.
 */
export interface CitaParaRegistro {
  /** Sigue programada: no tiene consulta, inasistencia, cancelación ni reprogramación. */
  programada: boolean
  /** Instante de inicio (ISO o `Date`). */
  inicio: string | Date
}

function instante(valor: string | Date): Date {
  return typeof valor === 'string' ? new Date(valor) : valor
}

/** La cita ya empezó: su inicio es ahora o antes. */
export function citaYaEmpezo(cita: Pick<CitaParaRegistro, 'inicio'>, ahora: Date): boolean {
  return instante(cita.inicio).getTime() <= ahora.getTime()
}

/** Va en Consultas › Por registrar (y cuenta en su insignia). */
export function citaPorRegistrar(cita: CitaParaRegistro, ahora: Date): boolean {
  return cita.programada && citaYaEmpezo(cita, ahora)
}

/** La Agenda muestra "Registrar" en esta cita: lo que está por registrar o lo de hoy que aún no empieza. */
export function citaRegistrableEnAgenda(cita: CitaParaRegistro, ahora: Date): boolean {
  if (!cita.programada) return false
  return citaYaEmpezo(cita, ahora) || fechaCalendarioGT(instante(cita.inicio)) === fechaCalendarioGT(ahora)
}
