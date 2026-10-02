import {
  AREAS_ATENCION,
  ETIQUETAS_AREA_ATENCION,
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

const DEPARTAMENTO_ALTA_VERAPAZ = 'Alta Verapaz'

export function textoDepartamento(usuaria: UsuariaExpedienteHub): string | null {
  return usuaria.municipio ? DEPARTAMENTO_ALTA_VERAPAZ : usuaria.departamentoOtro
}

/** Solo el municipio, sin el departamento (que va en su propio campo). */
export function textoMunicipio(usuaria: UsuariaExpedienteHub): string | null {
  if (!usuaria.municipio) return usuaria.municipioOtro
  return (
    ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ[usuaria.municipio as keyof typeof ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ] ??
    usuaria.municipio
  )
}

/** Áreas que ven los datos personales: las referidas en el caso activo; Jurídico siempre. */
export function textoAreasQueVenDatos(caso: ExpedienteResumenCaso | null): string {
  const areas = AREAS_ATENCION.filter((area) => area === 'JURIDICO' || caso?.areasReferidas.includes(area)).map(
    (area) => ETIQUETAS_AREA_ATENCION[area],
  )
  return areas.length === 1 ? areas[0] : `${areas.slice(0, -1).join(', ')} y ${areas[areas.length - 1]}`
}

/** Badge del encabezado: tipo de registro del caso actual y si sigue en el albergue. */
export function badgeRegistro(caso: ExpedienteResumenCaso | null): { tono: BadgeTono; texto: string } | null {
  if (!caso) return null
  if (caso.enAlbergue) return { tono: 'brand', texto: 'Interna · en albergue' }
  return caso.tipoRegistro === 'INTERNA'
    ? { tono: 'neutral', texto: 'Interna · egresó' }
    : { tono: 'neutral', texto: 'Externa' }
}
