import { diaSemanaGT, nombreMesGT, sumarDiasGT } from '@akyuam/shared'

// Fechas de calendario "YYYY-MM-DD" como texto: nunca se envuelven en un `Date` (ahí se cuela el
// corrimiento de medianoche). El cálculo pasa por `timezone.ts`.

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function partes(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return { anio, mes, dia }
}

/** "Lun". */
export function diaSemanaCorto(fecha: string): string {
  return DIAS_CORTOS[diaSemanaGT(fecha) - 1]
}

export function numeroDia(fecha: string): number {
  return partes(fecha).dia
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

/** "08:30" + 60 → "09:30". Solo reloj de pared dentro del mismo día (la agenda no cruza medianoche). */
export function horaMasMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number)
  const total = h * 60 + m + minutos
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** "30 min", "45 min", "1 h", "1 h 30". */
export function textoDuracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas} h` : `${horas} h ${resto}`
}
