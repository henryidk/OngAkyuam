import {
  ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ,
  ETIQUETAS_TIPOLOGIA_DELITO,
  type MUNICIPIOS_ALTA_VERAPAZ,
  type TIPOLOGIAS_DELITO,
} from '../catalogos/registroUsuaria.js'

/**
 * Columnas de lugar y tipología del formato "Población beneficiada" de la ONG. Las comparten el
 * reporte de Trabajo Social y el de Jurídico, para que una misma usuaria salga igual en los dos.
 */

export const DEPARTAMENTO_ALTA_VERAPAZ = 'Alta Verapaz'

export interface LugarUsuaria {
  /** `null` = la usuaria es de fuera de Alta Verapaz: valen los campos escritos a mano. */
  municipio: (typeof MUNICIPIOS_ALTA_VERAPAZ)[number] | null
  departamentoOtro: string | null
  municipioOtro: string | null
}

export function lugarParaReporte(lugar: LugarUsuaria): { departamento: string; municipio: string } {
  if (lugar.municipio !== null) {
    return {
      departamento: DEPARTAMENTO_ALTA_VERAPAZ,
      municipio: ETIQUETAS_MUNICIPIO_ALTA_VERAPAZ[lugar.municipio],
    }
  }
  return { departamento: lugar.departamentoOtro ?? '', municipio: lugar.municipioOtro ?? '' }
}

/** "Física, Psicológica": en el orden en que se registraron. */
export function etiquetasTipologia(tipologias: readonly (typeof TIPOLOGIAS_DELITO)[number][]): string {
  return tipologias.map((tipologia) => ETIQUETAS_TIPOLOGIA_DELITO[tipologia]).join(', ')
}

/**
 * Procedencia en una sola celda, de lo particular a lo general: "Aldea Chicoj, San Pedro Carchá,
 * Alta Verapaz". Omite lo que no se registró.
 */
export function procedenciaParaReporte(lugar: LugarUsuaria & { ubicacionGeografica: string | null }): string {
  const { departamento, municipio } = lugarParaReporte(lugar)
  return [lugar.ubicacionGeografica?.trim(), municipio, departamento].filter(Boolean).join(', ')
}
