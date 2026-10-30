import {
  anioExpedienteSchema,
  diasEntreFechasGT,
  type ProximaAudienciaDto,
  type ResumenProcesos,
} from '@akyuam/shared'

export interface TextoProximaAudiencia {
  /** "Hoy", "Mañana", "En 7 días" o "Falta registrar resultado". */
  aviso: string
  /** Ya pasó y nadie registró qué ocurrió: se pinta en ámbar. */
  pendiente: boolean
}

/** El aviso bajo la fecha en la columna Audiencia; `hoy` es la fecha de Guatemala ("YYYY-MM-DD"). */
export function textoProximaAudiencia(proxima: ProximaAudienciaDto, hoy: string): TextoProximaAudiencia {
  if (proxima.estadoVisible === 'PENDIENTE_RESULTADO') return { aviso: 'Falta registrar resultado', pendiente: true }
  const dias = diasEntreFechasGT(hoy, proxima.fecha)
  if (proxima.estadoVisible === 'HOY' || dias <= 0) return { aviso: 'Hoy', pendiente: false }
  if (dias === 1) return { aviso: 'Mañana', pendiente: false }
  return { aviso: `En ${dias} días`, pendiente: false }
}

/** La carpeta elegida vive en la URL como `anio=2014`; sin parámetro (o uno inválido) es "Todos". */
export function anioDesdeUrl(valor: string | null): number | null {
  if (!valor) return null
  const anio = anioExpedienteSchema.safeParse(valor)
  return anio.success ? anio.data : null
}

export interface Carpeta {
  anio: number
  /** `null` si no hay resumen o si la lista está acotada (búsqueda o "Solo asignados a mí"). */
  total: number | null
  esAnioActual: boolean
}

export interface OpcionesCarpetas {
  /** Total de la opción "Todos". */
  todos: number | null
  /** Una carpeta por año con procesos en curso, de la más reciente a la más antigua. */
  carpetas: Carpeta[]
}

/**
 * Carpetas por año del expediente. El año en curso siempre aparece (aunque esté vacío, es donde
 * entra el trabajo nuevo) y también el elegido en la URL, para que el chip activo nunca desaparezca.
 */
export function opcionesCarpetas(
  anioActual: number,
  resumen: Pick<ResumenProcesos, 'enTramite' | 'enTramitePorAnio'> | null,
  { anioElegido, conTotales }: { anioElegido: number | null; conTotales: boolean },
): OpcionesCarpetas {
  const totales = new Map((resumen?.enTramitePorAnio ?? []).map(({ anio, total }) => [anio, total]))
  const anios = new Set([anioActual, ...totales.keys(), ...(anioElegido === null ? [] : [anioElegido])])
  return {
    todos: conTotales ? (resumen?.enTramite ?? null) : null,
    carpetas: [...anios]
      .sort((a, b) => b - a)
      .map((anio) => ({
        anio,
        total: conTotales && resumen ? (totales.get(anio) ?? 0) : null,
        esAnioActual: anio === anioActual,
      })),
  }
}
