import type { AudienciaFilaDto } from '../schemas/audienciasJuridico.js'
import { diasEntreFechasGT, sumarDiasGT } from '../timezone.js'

/**
 * Avisos de audiencias próximas para todo el equipo de Jurídico. No se guardan en la base: se
 * calculan en cada consulta a partir de las audiencias PROGRAMADAS, así que una audiencia
 * reprogramada o cancelada deja de avisarse sola, sin "notificaciones huérfanas".
 */

/** Se avisa desde 7 días antes (hoy + 7 incluido). */
export const DIAS_ANTICIPACION_AVISO_AUDIENCIA = 7

/** Tope de la consulta: si un día hubiera más, el panel dice cuántas faltan. */
export const MAX_AVISOS_AUDIENCIA = 100

/** De más a menos urgente. */
export const NIVELES_AVISO_AUDIENCIA = ['HOY', 'MANANA', 'PASADO_MANANA', 'PROXIMOS_DIAS'] as const
export type NivelAvisoAudiencia = (typeof NIVELES_AVISO_AUDIENCIA)[number]

export const ETIQUETAS_NIVEL_AVISO_AUDIENCIA: Record<NivelAvisoAudiencia, string> = {
  HOY: 'Hoy',
  MANANA: 'Mañana',
  PASADO_MANANA: 'Pasado mañana',
  PROXIMOS_DIAS: 'Próximos días',
}

/**
 * Nivel por días de calendario en Guatemala, no por horas: una audiencia a las 8:00 de mañana
 * es "Mañana" aunque falten 10 horas. `null` = ya pasó o está fuera de la anticipación.
 */
export function nivelAvisoAudiencia(fechaAudiencia: string, hoy: string): NivelAvisoAudiencia | null {
  const dias = diasEntreFechasGT(hoy, fechaAudiencia)
  if (dias < 0 || dias > DIAS_ANTICIPACION_AVISO_AUDIENCIA) return null
  if (dias === 0) return 'HOY'
  if (dias === 1) return 'MANANA'
  if (dias === 2) return 'PASADO_MANANA'
  return 'PROXIMOS_DIAS'
}

/**
 * Solo lo que la campana muestra (exposición mínima): ni número judicial, ni acciones, ni
 * versión. El detalle completo sigue en la sección Audiencias, con sus propias reglas.
 */
export type AudienciaAvisoDto = Pick<
  AudienciaFilaDto,
  'id' | 'procesoId' | 'fecha' | 'hora' | 'tipoProceso' | 'descripcion' | 'usuaria' | 'responsable'
>

export interface AvisoAudienciaDto {
  nivel: NivelAvisoAudiencia
  /** Días de calendario que faltan (0 = hoy). */
  diasRestantes: number
  audiencia: AudienciaAvisoDto
}

/** `GET /juridico/avisos/audiencias`. */
export interface AvisosAudienciasDto {
  /** Fecha de calendario en Guatemala con la que se calcularon los niveles. */
  hoy: string
  /** De la más cercana a la más lejana. */
  avisos: AvisoAudienciaDto[]
  conteos: Record<NivelAvisoAudiencia, number>
  /** Total real; mayor que `avisos.length` solo si se alcanzó `MAX_AVISOS_AUDIENCIA`. */
  total: number
}

/** Días (desde hoy) que abarca cada nivel. */
const DIAS_NIVEL: Record<NivelAvisoAudiencia, { desde: number; hasta: number }> = {
  HOY: { desde: 0, hasta: 0 },
  MANANA: { desde: 1, hasta: 1 },
  PASADO_MANANA: { desde: 2, hasta: 2 },
  PROXIMOS_DIAS: { desde: 3, hasta: DIAS_ANTICIPACION_AVISO_AUDIENCIA },
}

/** Fechas de calendario que abarca un nivel: el filtro de la sección Audiencias al hacer clic. */
export function rangoNivelAviso(nivel: NivelAvisoAudiencia, hoy: string): { desde: string; hasta: string } {
  const { desde, hasta } = DIAS_NIVEL[nivel]
  return { desde: sumarDiasGT(hoy, desde), hasta: sumarDiasGT(hoy, hasta) }
}

const FRASE_NIVEL: Record<NivelAvisoAudiencia, string> = {
  HOY: 'hoy',
  MANANA: 'mañana',
  PASADO_MANANA: 'pasado mañana',
  PROXIMOS_DIAS: 'en los próximos días',
}

/**
 * "1 hoy, 2 mañana y 3 en los próximos días". Solo cifras: es el texto de la notificación del
 * sistema operativo, que se ve en la pantalla bloqueada y queda en su historial, fuera del
 * control de acceso de la app. Nunca nombres ni números de expediente.
 */
export function resumenAvisosAudiencias(conteos: Record<NivelAvisoAudiencia, number>): string {
  const partes = NIVELES_AVISO_AUDIENCIA.filter((nivel) => conteos[nivel] > 0).map(
    (nivel) => `${conteos[nivel]} ${FRASE_NIVEL[nivel]}`,
  )
  if (partes.length <= 1) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}

/** El nivel más urgente con al menos una audiencia; `null` si no hay ninguna. */
export function nivelMasUrgente(conteos: Record<NivelAvisoAudiencia, number>): NivelAvisoAudiencia | null {
  return NIVELES_AVISO_AUDIENCIA.find((nivel) => conteos[nivel] > 0) ?? null
}

export interface ContenidoNotificacionAvisos {
  titulo: string
  cuerpo: string
  /** El nivel del título: al hacer clic se filtran justo esas audiencias. */
  nivel: NivelAvisoAudiencia
}

function audiencias(total: number): string {
  return `${total} ${total === 1 ? 'audiencia' : 'audiencias'}`
}

/**
 * Notificación del navegador: el título es lo más urgente ("Mañana: 2 audiencias") y el cuerpo,
 * el resto. Solo cifras, nunca nombres ni expedientes. `null` si no hay nada que avisar.
 */
export function contenidoNotificacionAvisos(
  conteos: Record<NivelAvisoAudiencia, number>,
): ContenidoNotificacionAvisos | null {
  const nivel = nivelMasUrgente(conteos)
  if (nivel === null) return null
  const resto = resumenAvisosAudiencias({ ...conteos, [nivel]: 0 })
  return {
    titulo: `${ETIQUETAS_NIVEL_AVISO_AUDIENCIA[nivel]}: ${audiencias(conteos[nivel])}`,
    cuerpo: resto ? `Además: ${resto}. Haz clic para verlas.` : 'Haz clic para verlas.',
    nivel,
  }
}
