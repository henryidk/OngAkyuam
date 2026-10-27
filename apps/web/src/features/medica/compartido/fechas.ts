import {
  diaSemanaGT,
  fechaCalendarioGT,
  formatFechaGT,
  formatFechaLargaGT,
  nombreMesGT,
  sumarDiasGT,
} from '@akyuam/shared'

// Todo aquí trabaja sobre fechas de calendario "YYYY-MM-DD" como texto: nunca se envuelven en
// un `Date` (ahí se cuela el corrimiento de medianoche). El cálculo pasa por `timezone.ts`.

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function partes(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return { anio, mes, dia }
}

/** "08/10/2026": el día en Guatemala de un instante ISO, sin la hora. */
export function fechaDeInstante(instante: string): string {
  return formatFechaGT(fechaCalendarioGT(new Date(instante)))
}

/** "8 oct". */
export function fechaCorta(fecha: string): string {
  const { mes, dia } = partes(fecha)
  return `${dia} ${MESES_CORTOS[mes - 1]}`
}

/** "Jueves 8 de octubre". */
export function fechaLarga(fecha: string): string {
  return formatFechaLargaGT(fecha)
}

/** "jueves 8 de octubre", para usarla dentro de una frase. */
export function fechaLargaEnFrase(fecha: string): string {
  const texto = formatFechaLargaGT(fecha)
  return texto.charAt(0).toLowerCase() + texto.slice(1)
}

/** "Lun". */
export function diaSemanaCorto(fecha: string): string {
  return DIAS_CORTOS[diaSemanaGT(fecha) - 1]
}

export function numeroDia(fecha: string): number {
  return partes(fecha).dia
}

export function anioDe(fecha: string): number {
  return partes(fecha).anio
}

/** "5 – 9 octubre 2026", o "28 sep – 2 oct 2026" si la semana cruza de mes. */
export function textoSemana(lunes: string): string {
  const viernes = sumarDiasGT(lunes, 4)
  const inicio = partes(lunes)
  const fin = partes(viernes)
  if (inicio.mes === fin.mes) {
    return `${inicio.dia} – ${fin.dia} ${nombreMesGT(fin.mes).toLowerCase()} ${fin.anio}`
  }
  return `${inicio.dia} ${MESES_CORTOS[inicio.mes - 1]} – ${fin.dia} ${MESES_CORTOS[fin.mes - 1]} ${fin.anio}`
}

/** La propia fecha si es día hábil; si cae en fin de semana, el lunes siguiente. */
export function diaHabil(fecha: string): string {
  const dia = diaSemanaGT(fecha)
  if (dia === 6) return sumarDiasGT(fecha, 2)
  if (dia === 7) return sumarDiasGT(fecha, 1)
  return fecha
}

/** "08:30" + 60 → "09:30". Solo reloj de pared dentro del mismo día (la agenda no cruza medianoche). */
export function horaMasMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number)
  const total = h * 60 + m + minutos
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
