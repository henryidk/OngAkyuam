import type { EstadoCitaMedicaDerivado, FiltroPacientesMedica } from '@akyuam/shared'

/**
 * Vocabulario de color del módulo (el del mockup). Cada tono significa siempre lo mismo: verde =
 * resuelto o en atención, ámbar = pide acción, morado = está pasando ahora, gris = cerrado.
 */
export type TonoMedica = 'blue' | 'green' | 'amber' | 'gray' | 'purple' | 'red'

export const CLASES_TONO: Record<TonoMedica, string> = {
  blue: 'bg-[#e8f0fb] text-[#1f5aa6]',
  green: 'bg-[#e7f1ea] text-[#2f6b3f]',
  amber: 'bg-[#fbf1de] text-[#8a5a14]',
  gray: 'bg-[#f0f2f4] text-[#4b5563]',
  purple: 'bg-[#f2ecfa] text-[#5b3985]',
  red: 'bg-[#fbe4e1] text-[#9b2c20]',
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
export const CLASE_TARJETA = 'rounded-xl border border-[#e3e6ea] bg-white'

/** Eyebrow sobre el título de cada pantalla ("AGENDA DE CONSULTAS"). */
export const CLASE_EYEBROW = 'text-xs font-semibold uppercase tracking-wide text-[#5b6573]'

export const CLASE_H1 = 'text-2xl font-semibold text-[#1c2430]'

/** Encabezado de sección dentro de una tarjeta o formulario. */
export const CLASE_SECCION = 'text-[11px] font-semibold uppercase tracking-wide text-[#5b6573]'

export const CLASE_CAMPO =
  'w-full rounded-md border border-[#d5dadf] bg-white px-3 py-2 text-sm text-[#1c2430] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

/** Enlace de texto subrayado para las acciones secundarias ("Ver ficha", "Ver consulta"). */
export const CLASE_ENLACE = 'text-[13px] font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800'

/** Botón con borde morado del mockup ("Reprogramar"). */
export const CLASE_BOTON_BORDE =
  'inline-flex items-center gap-1.5 rounded-md border border-brand-600 bg-white px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60'
