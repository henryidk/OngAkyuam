import { z } from 'zod'

/**
 * Reserva de una referencia del Área de atención (Psicología y Médica): mientras alguien agenda
 * la primera cita o atiende ahora, el caso sigue sin tomar, pero las demás ven el botón ocupado.
 * Vive solo en Redis: no es un dato del caso ni se audita.
 */
export const MOTIVOS_RESERVA_CASO = ['AGENDANDO', 'ATENDIENDO'] as const
export type MotivoReservaCaso = (typeof MOTIVOS_RESERVA_CASO)[number]

export const ETIQUETAS_MOTIVO_RESERVA_CASO: Record<MotivoReservaCaso, string> = {
  AGENDANDO: 'está agendando',
  ATENDIENDO: 'está atendiendo ahora',
}

/** Cada cuánto renueva la reserva la pantalla que la tiene abierta. */
export const RENOVACION_RESERVA_CASO_MS = 20_000
/** Sin renovarse (pestaña cerrada, sin luz o sin internet), la reserva vence sola. */
export const VIGENCIA_RESERVA_CASO_SEGUNDOS = 60

export const reservarCasoSchema = z.object({
  motivo: z.enum(MOTIVOS_RESERVA_CASO),
})
export type ReservarCasoInput = z.infer<typeof reservarCasoSchema>

/** Quién tiene reservada la referencia. Solo el nombre del personal: nada de la usuaria. */
export interface ReservaCasoDto {
  nombre: string
  /** Instante en que empezó la reserva (ISO). */
  desde: string
  motivo: MotivoReservaCaso
  /** `true` = la reserva es de quien pregunta. */
  propia: boolean
}
