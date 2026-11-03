import { diaSemanaGT, fechaCalendarioGT, horaGT, minutosDelDiaGT } from '@akyuam/shared'

const UNA_HORA_MS = 60 * 60 * 1000

/**
 * Milisegundos hasta la próxima hora en punto (8:00, 9:00…). Guatemala está a un número entero
 * de horas de UTC, así que la hora en punto de UTC es también la de Guatemala.
 */
export function msHastaSiguienteHora(ahoraMs: number): number {
  return UNA_HORA_MS - (ahoraMs % UNA_HORA_MS)
}

/** Horario de oficina de AKyuam en Guatemala: de lunes a viernes, de 8:00 a 17:00. */
export const INICIO_OFICINA_MIN = 8 * 60
export const FIN_OFICINA_MIN = 17 * 60

/** Lunes = 1 … viernes = 5 (ISO). */
const ULTIMO_DIA_LABORAL = 5

/**
 * Los avisos (sonido y notificación) solo salen en horario de oficina: de lunes a viernes, el
 * último a las 16:00. Fuera de horario, una computadora encendida no suena y no consulta al
 * servidor. El día se toma en Guatemala: el viernes 20:00 GT ya es sábado en UTC.
 */
export function enHorarioOficina(ahora: Date): boolean {
  if (diaSemanaGT(fechaCalendarioGT(ahora)) > ULTIMO_DIA_LABORAL) return false
  const minutos = minutosDelDiaGT(ahora)
  return minutos >= INICIO_OFICINA_MIN && minutos < FIN_OFICINA_MIN
}

/** "2026-11-03T14": identifica la franja horaria del aviso, en Guatemala. */
export function franjaHora(ahora: Date): string {
  return `${fechaCalendarioGT(ahora)}T${horaGT(ahora).slice(0, 2)}`
}

/**
 * Con la app abierta en varias pestañas, solo una avisa por franja. En `localStorage` va
 * únicamente la franja y el id de la cuenta, nunca datos de audiencias ni de usuarias.
 * `navigator.locks` evita que dos pestañas que disparan a la vez (las dos a la hora en punto)
 * lean "nadie avisó" al mismo tiempo.
 */
export async function reclamarFranja(usuarioId: string, franja: string): Promise<boolean> {
  const clave = `akyuam:juridico:avisoAudiencias:${usuarioId}`
  const reclamar = () => {
    try {
      if (localStorage.getItem(clave) === franja) return false
      localStorage.setItem(clave, franja)
    } catch {
      // Sin almacenamiento (modo privado estricto): mejor avisar de más que no avisar.
    }
    return true
  }
  if ('locks' in navigator) {
    return navigator.locks.request(clave, reclamar)
  }
  return reclamar()
}
