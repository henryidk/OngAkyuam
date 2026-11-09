import type { EstadoCitaMedicaDerivado, FiltroPacientesMedica } from '@akyuam/shared'

/**
 * Vocabulario de color del módulo (el del mockup). Cada tono significa siempre lo mismo: verde =
 * resuelto o en atención, ámbar = pide acción, morado = está pasando ahora, gris = cerrado.
 */
export type TonoMedica = 'blue' | 'green' | 'amber' | 'gray' | 'purple' | 'red'

export const CLASES_TONO: Record<TonoMedica, string> = {
  blue: 'bg-estado-info-insignia text-estado-info',
  green: 'bg-estado-ok-insignia text-estado-ok',
  amber: 'bg-estado-pendiente-insignia text-estado-pendiente',
  gray: 'bg-superficie-hundida text-texto-cuerpo',
  purple: 'bg-seleccion text-brand-700',
  red: 'bg-estado-error-insignia text-estado-error',
}

export const TONO_ESTADO_CITA: Record<EstadoCitaMedicaDerivado, TonoMedica> = {
  PROGRAMADA: 'blue',
  ATENDIDA: 'green',
  NO_ASISTIO: 'gray',
  CANCELADA: 'gray',
  EN_CURSO: 'purple',
  SIN_REGISTRAR: 'amber',
}

export const TONO_SITUACION: Record<FiltroPacientesMedica, TonoMedica> = {
  EN_ATENCION: 'green',
  POR_AGENDAR: 'amber',
  DE_ALTA: 'gray',
}

/** Tarjeta blanca con borde suave: el contenedor de casi todo bloque del módulo. */
export const CLASE_TARJETA = 'rounded-xl border border-borde bg-white'

/** Eyebrow sobre el título de cada pantalla ("AGENDA DE CONSULTAS"). */
export const CLASE_EYEBROW = 'text-xs font-semibold uppercase tracking-wide text-texto-suave'

export const CLASE_H1 = 'text-2xl font-semibold text-texto'

/** Encabezado de sección dentro de una tarjeta o formulario. */
export const CLASE_SECCION = 'text-[11px] font-semibold uppercase tracking-wide text-texto-suave'

export const CLASE_CAMPO =
  'w-full rounded-md border border-borde-fuerte bg-white px-3 py-2 text-sm text-texto focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

/** Enlace de texto subrayado para las acciones secundarias ("Ver ficha", "Ver consulta"). */
export const CLASE_ENLACE = 'text-[13px] font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800'

/** Botón con borde morado del mockup ("Reprogramar"). */
export const CLASE_BOTON_BORDE =
  'inline-flex items-center gap-1.5 rounded-md border border-brand-600 bg-white px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60'
