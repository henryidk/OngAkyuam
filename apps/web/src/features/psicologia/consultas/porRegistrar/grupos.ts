import { diasEntreFechasGT, fechaCalendarioGT, type SesionPorRegistrarDto } from '@akyuam/shared'

export interface SesionAtrasada {
  sesion: SesionPorRegistrarDto
  /** Días de calendario de Guatemala desde la sesión hasta hoy: 1 = ayer. */
  dias: number
}

export interface GruposPorRegistrar {
  hoy: SesionPorRegistrarDto[]
  /** De la más reciente a la más antigua: lo de ayer todavía se recuerda mejor. */
  atrasadas: SesionAtrasada[]
}

/**
 * Reparte las sesiones por registrar en las de hoy y las de días anteriores. El día es el de
 * Guatemala, no el del navegador: una sesión de anoche a las 23:00 ya es atrasada.
 */
export function agruparPorRegistrar(sesiones: SesionPorRegistrarDto[], hoy: string): GruposPorRegistrar {
  const grupos: GruposPorRegistrar = { hoy: [], atrasadas: [] }
  for (const sesion of sesiones) {
    const dias = diasEntreFechasGT(fechaCalendarioGT(new Date(sesion.fechaHora)), hoy)
    if (dias <= 0) grupos.hoy.push(sesion)
    else grupos.atrasadas.push({ sesion, dias })
  }
  grupos.atrasadas.sort((a, b) => b.sesion.fechaHora.localeCompare(a.sesion.fechaHora))
  return grupos
}

/** "ayer", "hace 3 días": la antigüedad en texto, para no depender solo del color. */
export function textoAtraso(dias: number): string {
  return dias === 1 ? 'ayer' : `hace ${dias} días`
}
