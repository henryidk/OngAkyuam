// La hora se guarda y viaja como "HH:mm" de 24 horas; en pantalla se elige y se lee en 12 horas
// ("10:00 a. m."), que es como la dice el personal.

export type Periodo = 'AM' | 'PM'

export const ETIQUETAS_PERIODO: Record<Periodo, string> = { AM: 'a. m.', PM: 'p. m.' }

export interface Hora12 {
  /** 1 a 12. */
  hora: number
  /** "00" a "59". */
  minutos: string
  periodo: Periodo
}

/** "13:05" → 1:05 p. m.; `null` si no es una hora "HH:mm" válida. */
export function aHora12(hhmm: string): Hora12 | null {
  const partes = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!partes) return null
  const horas = Number(partes[1])
  if (horas > 23 || Number(partes[2]) > 59) return null
  return { hora: horas % 12 === 0 ? 12 : horas % 12, minutos: partes[2], periodo: horas < 12 ? 'AM' : 'PM' }
}

/** 12:30 a. m. → "00:30"; 12:30 p. m. → "12:30". */
export function aHora24({ hora, minutos, periodo }: Hora12): string {
  const horas = (hora % 12) + (periodo === 'PM' ? 12 : 0)
  return `${String(horas).padStart(2, '0')}:${minutos}`
}

/** "09:30" → "9:30 a. m."; si no es una hora válida se deja como vino. */
export function formatHora12(hhmm: string): string {
  const hora = aHora12(hhmm)
  return hora ? `${hora.hora}:${hora.minutos} ${ETIQUETAS_PERIODO[hora.periodo]}` : hhmm
}
