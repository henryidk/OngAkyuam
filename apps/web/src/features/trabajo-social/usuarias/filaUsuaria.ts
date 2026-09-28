import {
  calcularRangoEdad,
  edadEnAniosGT,
  ETIQUETAS_AREA_ATENCION,
  FILTROS_LISTA_USUARIAS,
  type AreaAtencion,
  type FiltroListaUsuarias,
} from '@akyuam/shared'

/** Rango del reporte de población beneficiada en corto: "31–60", "60+". */
export function rangoEdadCorto(edad: number): string {
  const rango = calcularRangoEdad(edad)
  return rango === 'MAYOR_60' ? '60+' : rango.replace('-', '–')
}

/** "35 · 31–60": edad y rango. */
export function textoEdad(fechaNacimiento: string): string {
  const edad = edadEnAniosGT(fechaNacimiento)
  return `${edad} · ${rangoEdadCorto(edad)}`
}

export function textoAreas(areas: AreaAtencion[]): string {
  return areas.length > 0 ? areas.map((area) => ETIQUETAS_AREA_ATENCION[area]).join(', ') : '—'
}

export function textoHijos(cantidad: number): string | null {
  if (cantidad === 0) return null
  return `Con ${cantidad} ${cantidad === 1 ? 'hija/hijo' : 'hijas/hijos'}`
}

/** La búsqueda se envía con 3 caracteres o más: el backend rechaza nombres más cortos. */
export const LARGO_MINIMO_BUSQUEDA = 3

export function filtroDesdeUrl(valor: string | null): FiltroListaUsuarias | null {
  return (FILTROS_LISTA_USUARIAS as readonly string[]).includes(valor ?? '') ? (valor as FiltroListaUsuarias) : null
}
