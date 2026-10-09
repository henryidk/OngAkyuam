import {
  diaSemanaGT,
  fechaCalendarioGT,
  sumarDiasGT,
  type CitaAgendaDto,
  type ProcesoParaAgendarDto,
} from '@akyuam/shared'

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/
const DIAS_LABORALES = 5
const DIAS_SEMANA = 7

/** Lunes de la semana a la que pertenece una fecha de calendario. */
export function lunesDe(fecha: string): string {
  return sumarDiasGT(fecha, 1 - diaSemanaGT(fecha))
}

/** Un parámetro de la URL solo vale si es una fecha: cualquier otra cosa se ignora. */
export function fechaValida(valor: string | null): string | null {
  return valor !== null && FORMATO_FECHA.test(valor) ? valor : null
}

/** Día de Guatemala en que cae una cita. */
export function diaDeCita(cita: CitaAgendaDto): string {
  return fechaCalendarioGT(new Date(cita.fechaHora))
}

/**
 * Los días que muestra el navegador: de lunes a viernes, más el sábado o el domingo solo si
 * tienen citas o están abiertos. El horario no se valida, así que una cita de fin de semana
 * existe y no puede quedar escondida.
 */
export function diasVisibles(lunes: string, diaAbierto: string, diasConCitas: Set<string>): string[] {
  const semana = Array.from({ length: DIAS_SEMANA }, (_, indice) => sumarDiasGT(lunes, indice))
  return semana.filter(
    (dia, indice) => indice < DIAS_LABORALES || dia === diaAbierto || diasConCitas.has(dia),
  )
}

/**
 * La cita de hoy que lleva el botón principal: la que está en curso o, si no hay, la siguiente.
 * Las que ya terminaron sin registro tienen su propio aviso y no compiten por él.
 */
export function citaPrincipal(citasDeHoy: CitaAgendaDto[], ahora: number): string | null {
  const pendiente = citasDeHoy.find(
    (cita) =>
      cita.estado === 'PROGRAMADA' &&
      new Date(cita.fechaHora).getTime() + cita.duracionMinutos * 60_000 > ahora,
  )
  return pendiente?.id ?? null
}

/** "6 citas · 3 por atender · 1 atendida · 1 no asistió · 1 sin registrar". */
export function resumenDelDia(citas: CitaAgendaDto[]): string {
  if (citas.length === 0) return 'Sin citas'
  const sinRegistrar = citas.filter((cita) => cita.sinRegistrar).length
  const porAtender = citas.filter((cita) => cita.estado === 'PROGRAMADA').length - sinRegistrar
  const atendidas = citas.filter((cita) => cita.estado === 'ATENDIDA').length
  const noAsistio = citas.filter((cita) => cita.estado === 'NO_ASISTIO').length

  const partes = [citas.length === 1 ? '1 cita' : `${citas.length} citas`]
  if (porAtender > 0) partes.push(`${porAtender} por atender`)
  if (atendidas > 0) partes.push(atendidas === 1 ? '1 atendida' : `${atendidas} atendidas`)
  if (noAsistio > 0) partes.push(`${noAsistio} no asistió`)
  if (sinRegistrar > 0) partes.push(`${sinRegistrar} sin registrar`)
  return partes.join(' · ')
}

/**
 * Las citas sin registrar que van en el panel de atrasadas: todas menos las del día abierto, que
 * ya se ven en la lista principal. Cada pendiente aparece en un solo lugar.
 */
export function citasSinRegistrarFuera(dia: string, citas: CitaAgendaDto[]): CitaAgendaDto[] {
  return citas.filter((cita) => cita.sinRegistrar && diaDeCita(cita) !== dia)
}

/**
 * Procesos que de verdad se quedaron sin siguiente fecha. Con una cita sin registrar lo pendiente
 * es registrar esa sesión, no programar otra: ese proceso ya aparece en "Citas sin registrar".
 */
export function procesosSinProximaCita(procesos: ProcesoParaAgendarDto[]): ProcesoParaAgendarDto[] {
  return procesos.filter((proceso) => proceso.proximaCita === null && !proceso.tieneCitaSinRegistrar)
}
