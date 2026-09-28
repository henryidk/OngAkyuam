import {
  ETIQUETAS_GRUPO_ETNICO,
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  type ExpedienteResumenCaso,
  type UsuariaExpedienteHub,
} from '@akyuam/shared'
import type { BadgeTono } from '../../../components/ui/Badge'

export function nombreCompleto(usuaria: UsuariaExpedienteHub): string {
  return `${usuaria.nombres} ${usuaria.apellidos}`
}

export function iniciales(usuaria: UsuariaExpedienteHub): string {
  return `${usuaria.nombres.trim()[0] ?? ''}${usuaria.apellidos.trim()[0] ?? ''}`.toUpperCase()
}

export function textoGrupoEtnico(grupo: string): string {
  return ETIQUETAS_GRUPO_ETNICO[grupo as keyof typeof ETIQUETAS_GRUPO_ETNICO] ?? grupo
}

/** "Cobán, Alta Verapaz", o el municipio y departamento escritos a mano si es de fuera. */
export function textoUbicacion(usuaria: UsuariaExpedienteHub): string | null {
  if (usuaria.municipio) {
    const municipio =
      ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ[usuaria.municipio as keyof typeof ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ] ??
      usuaria.municipio
    return `${municipio}, Alta Verapaz`
  }
  if (usuaria.municipioOtro) {
    return [usuaria.municipioOtro, usuaria.departamentoOtro].filter(Boolean).join(', ')
  }
  return null
}

/** Badge del encabezado: tipo de registro del caso actual y si sigue en el albergue. */
export function badgeRegistro(caso: ExpedienteResumenCaso | null): { tono: BadgeTono; texto: string } | null {
  if (!caso) return null
  if (caso.enAlbergue) return { tono: 'brand', texto: 'Interna · en albergue' }
  return caso.tipoRegistro === 'INTERNA'
    ? { tono: 'neutral', texto: 'Interna · egresó' }
    : { tono: 'neutral', texto: 'Externa' }
}
