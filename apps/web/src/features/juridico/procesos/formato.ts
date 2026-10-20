import {
  CARTERAS_JURIDICO,
  diasEntreFechasGT,
  type CarteraJuridico,
  type ProximaAudienciaDto,
  type ResumenProcesos,
} from '@akyuam/shared'

export interface TextoProximaAudiencia {
  /** "Hoy", "Mañana", "En 7 días" o "Pendiente de resultado". */
  aviso: string
  /** Ya pasó y nadie registró qué ocurrió: se pinta en ámbar. */
  pendiente: boolean
}

/** El aviso bajo la fecha en la columna Próxima audiencia; `hoy` es la fecha de Guatemala ("YYYY-MM-DD"). */
export function textoProximaAudiencia(proxima: ProximaAudienciaDto, hoy: string): TextoProximaAudiencia {
  if (proxima.estadoVisible === 'PENDIENTE_RESULTADO') return { aviso: 'Pendiente de resultado', pendiente: true }
  const dias = diasEntreFechasGT(hoy, proxima.fecha)
  if (proxima.estadoVisible === 'HOY' || dias <= 0) return { aviso: 'Hoy', pendiente: false }
  if (dias === 1) return { aviso: 'Mañana', pendiente: false }
  return { aviso: `En ${dias} días`, pendiente: false }
}

/** El filtro por años vive en la URL como `cartera=anio|seguimiento`; sin parámetro es "Todos". */
export function carteraDesdeUrl(valor: string | null): CarteraJuridico {
  const mayusculas = valor?.toUpperCase()
  return CARTERAS_JURIDICO.find((cartera) => cartera === mayusculas) ?? 'TODOS'
}

export function carteraAUrl(cartera: CarteraJuridico): string | null {
  return cartera === 'TODOS' ? null : cartera.toLowerCase()
}

export interface OpcionCartera {
  valor: CarteraJuridico
  etiqueta: string
  /** `null` si no hay resumen o si la lista está acotada (búsqueda o "Solo asignados a mí"). */
  total: number | null
}

/** "Todos · Año en curso 2026 · Seguimiento": los totales son de todos los procesos en curso. */
export function opcionesCartera(
  anio: number,
  resumen: Pick<ResumenProcesos, 'enTramite' | 'enTramitePorCartera'> | null,
): OpcionCartera[] {
  return [
    { valor: 'TODOS', etiqueta: 'Todos', total: resumen?.enTramite ?? null },
    { valor: 'ANIO', etiqueta: `Año en curso ${anio}`, total: resumen?.enTramitePorCartera.anio ?? null },
    { valor: 'SEGUIMIENTO', etiqueta: 'Seguimiento', total: resumen?.enTramitePorCartera.seguimiento ?? null },
  ]
}
