import {
  diaSemanaGT,
  diasEntreFechasGT,
  fechaCalendarioGT,
  formatFechaGT,
  formatFechaLargaGT,
  horaGT,
  hoyGT,
  sumarDiasGT,
  type EntradaBitacoraDto,
} from '@akyuam/shared'
import { formatHora12 } from '../compartido/hora12'

// Presentación de la bitácora y de la próxima audiencia en la ficha del proceso. Funciones puras:
// `hoy` ("YYYY-MM-DD" de Guatemala) llega como argumento para que las pruebas no dependan del reloj.

/** Día de Guatemala de un instante, comparado con hoy: "hoy", "ayer" o "el 20/10/2026". */
export function textoDiaRelativo(instanteIso: string, hoy: string = hoyGT()): string {
  const dia = fechaCalendarioGT(new Date(instanteIso))
  if (dia === hoy) return 'hoy'
  if (dia === sumarDiasGT(hoy, -1)) return 'ayer'
  return `el ${formatFechaGT(dia)}`
}

/** Encabezado de cada día: "Hoy · Viernes 23 de octubre", "Ayer · …" o solo la fecha larga. */
export function tituloDia(fecha: string, hoy: string): string {
  const larga = formatFechaLargaGT(fecha)
  if (fecha === hoy) return `Hoy · ${larga}`
  if (fecha === sumarDiasGT(hoy, -1)) return `Ayer · ${larga}`
  return larga
}

export interface DiaBitacora {
  fecha: string
  titulo: string
  actuaciones: EntradaBitacoraDto[]
  /** Los cambios del sistema del día van aparte, plegados: no tapan lo que hizo el equipo. */
  sistema: EntradaBitacoraDto[]
}

/** Agrupa la bitácora (más reciente primero) por día de Guatemala, respetando ese orden. */
export function agruparBitacora(entradas: EntradaBitacoraDto[], hoy: string): DiaBitacora[] {
  const dias: DiaBitacora[] = []
  for (const entrada of entradas) {
    const fecha = fechaCalendarioGT(new Date(entrada.createdAt))
    let dia = dias.at(-1)
    if (dia?.fecha !== fecha) {
      dia = { fecha, titulo: tituloDia(fecha, hoy), actuaciones: [], sistema: [] }
      dias.push(dia)
    }
    ;(entrada.esSistema ? dia.sistema : dia.actuaciones).push(entrada)
  }
  return dias
}

/** Hora de Guatemala de un instante, en 12 horas ("9:30 a. m."). */
export function hora12DeInstante(instanteIso: string): string {
  return formatHora12(horaGT(instanteIso))
}

/** Letra del cuadro de cada actuación: la inicial de su tipo. */
export function inicialTipo(tipo: string): string {
  return (tipo.trim()[0] ?? '·').toUpperCase()
}

const MESES_CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

/** Bloque de calendario de la próxima audiencia: "OCT", "28", "mié". */
export function bloqueFecha(fecha: string): { mes: string; dia: string; diaSemana: string } {
  const [, mes, dia] = fecha.split('-')
  return {
    mes: MESES_CORTOS[Number(mes) - 1] ?? '',
    dia: String(Number(dia)),
    diaSemana: DIAS_CORTOS[diaSemanaGT(fecha) - 1] ?? '',
  }
}

/** "hoy", "mañana", "en 5 días" o, si ya pasó sin resultado, "hace 2 días". */
export function textoCuando(fecha: string, hoy: string): string {
  const dias = diasEntreFechasGT(hoy, fecha)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'mañana'
  if (dias === -1) return 'ayer'
  return dias > 0 ? `en ${dias} días` : `hace ${-dias} días`
}
