import type { EstadoVisibleProceso, FormaFinalizacionProceso } from '@akyuam/shared'

/**
 * Mapa único de color por estado y por forma de finalización (los del mockup). Ningún componente
 * repite estos valores: todos pasan por `EtiquetaEstado` / `EtiquetaForma`.
 */
export const CLASES_ESTADO: Record<EstadoVisibleProceso, string> = {
  EN_TRAMITE: 'bg-[#f7f3fc] text-[#7346a5]',
  FINALIZADO: 'bg-[#e7f1ea] text-[#2f6b3f]',
  ABANDONADO: 'bg-[#f6ecdc] text-[#8a5a14]',
  SUSPENDIDO: 'bg-[#eceef1] text-[#4a5360]',
}

export const CLASES_FORMA: Record<FormaFinalizacionProceso, string> = {
  CONVENIO: 'bg-[#e2ecf8] text-[#1f4f8a]',
  SENTENCIA: 'bg-[#e7f1ea] text-[#2f6b3f]',
  DESISTIMIENTO: 'bg-[#f3e8e6] text-[#8a3a2c]',
  OTROS: 'bg-[#eceef1] text-[#4a5360]',
}

/** Relleno de la barra de avance según el estado visible. */
export const CLASES_BARRA: Record<EstadoVisibleProceso, string> = {
  EN_TRAMITE: 'bg-[#7346a5]',
  FINALIZADO: 'bg-[#2f6b3f]',
  ABANDONADO: 'bg-[#8a5a14]',
  SUSPENDIDO: 'bg-[#4a5360]',
}

/** Relleno de las barras del reporte por forma de finalización. */
export const CLASES_BARRA_FORMA: Record<FormaFinalizacionProceso, string> = {
  CONVENIO: 'bg-[#1f4f8a]',
  SENTENCIA: 'bg-[#2f6b3f]',
  DESISTIMIENTO: 'bg-[#8a3a2c]',
  OTROS: 'bg-[#4a5360]',
}
