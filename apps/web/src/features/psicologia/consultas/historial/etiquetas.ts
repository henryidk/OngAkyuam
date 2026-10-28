import type { EstadoHistorialConsultasPsicologia } from '@akyuam/shared'

/** Cómo se nombra el resultado de una sesión del historial, siempre en texto y no solo con color. */
export const ETIQUETAS_ESTADO_HISTORIAL: Record<EstadoHistorialConsultasPsicologia, string> = {
  ATENDIDA: 'Atendida',
  NO_ASISTIO: 'No asistió',
}
