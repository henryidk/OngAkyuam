import type { UsuariaResumenBusqueda } from '@akyuam/shared'

const LARGO_DPI = 13
const LARGO_GRUPO_OCULTO_1 = 4
const LARGO_GRUPO_OCULTO_2 = 5

/** "**** ***** 1601": solo los últimos 4 dígitos del DPI son visibles. */
export function enmascararDpi(dpi: string): string {
  if (dpi.length !== LARGO_DPI) return dpi
  return `${'*'.repeat(LARGO_GRUPO_OCULTO_1)} ${'*'.repeat(LARGO_GRUPO_OCULTO_2)} ${dpi.slice(-4)}`
}

/** Línea secundaria de un resultado del buscador global: expediente y DPI enmascarado, lo que haya. */
export function subtituloResultadoBusqueda(item: UsuariaResumenBusqueda): string {
  const partes = [
    item.numeroExpediente ? `Expediente ${item.numeroExpediente}` : 'Sin expediente',
    item.dpi ? `DPI ${enmascararDpi(item.dpi)}` : null,
  ]
  return partes.filter(Boolean).join(' · ')
}
