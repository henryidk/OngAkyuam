import { useCallback, useState } from 'react'
import { AREAS_ATENCION, ETIQUETAS_AREA_ATENCION, referirSchema, type AreaAtencion } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { referirCaso } from '../../trabajo-social/api/trabajoSocial.api'

export interface ReferenciaArea {
  seleccionada: boolean
  /** Agresor, tipología y observaciones. Jurídico los ve siempre por normativa. */
  datosCaso: boolean
  /** Ya se envió: no se puede quitar desde aquí (para eso está la ficha). */
  referida: boolean
}

type ReferenciasPorArea = Record<AreaAtencion, ReferenciaArea>

const REFERENCIA_INICIAL: ReferenciaArea = { seleccionada: false, datosCaso: true, referida: false }

/**
 * Paso "Referir" del registro: a diferencia del modal de la ficha (un área a la vez), aquí se
 * eligen varias áreas de una vez porque es el momento en que Trabajo Social decide a dónde va
 * el caso. Los documentos todavía no existen: su visibilidad se elige en el paso siguiente.
 * El motivo es uno solo para todas las áreas: se copia a cada referencia (así sale una sola
 * "Descripción de referencia" en el reporte de población).
 */
export function useReferirAreas(expedienteId: string) {
  const [referencias, setReferencias] = useState<ReferenciasPorArea>(
    () => Object.fromEntries(AREAS_ATENCION.map((area) => [area, REFERENCIA_INICIAL])) as ReferenciasPorArea,
  )
  const [motivo, setMotivoEstado] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const actualizar = useCallback((area: AreaAtencion, cambios: Partial<ReferenciaArea>) => {
    setReferencias((actuales) =>
      actuales[area].referida ? actuales : { ...actuales, [area]: { ...actuales[area], ...cambios } },
    )
    setError(null)
  }, [])

  const setMotivo = useCallback((valor: string) => {
    setMotivoEstado(valor)
    setError(null)
  }, [])

  const porEnviar = AREAS_ATENCION.filter((area) => referencias[area].seleccionada && !referencias[area].referida)
  const referidas = AREAS_ATENCION.filter((area) => referencias[area].referida)

  /**
   * Envía una referencia por área, en orden. Si una falla se detiene ahí: las anteriores ya
   * quedaron referidas (se marcan para no reenviarlas al reintentar). Devuelve `true` si todo salió.
   */
  const referirSeleccionadas = useCallback(async (): Promise<boolean> => {
    setError(null)
    setEnviando(true)
    try {
      for (const area of porEnviar) {
        const { datosCaso } = referencias[area]
        const validado = referirSchema.safeParse({ area, motivo, visibilidad: { datosCaso, documentos: [] } })
        if (!validado.success) {
          setError(`${ETIQUETAS_AREA_ATENCION[area]}: ${validado.error.issues[0]?.message ?? 'revisa la referencia'}`)
          return false
        }
        try {
          await referirCaso(expedienteId, validado.data)
        } catch (err) {
          setError(`No se pudo referir a ${ETIQUETAS_AREA_ATENCION[area]}: ${extraerMensajeError(err)}`)
          return false
        }
        setReferencias((actuales) => ({ ...actuales, [area]: { ...actuales[area], referida: true } }))
      }
      return true
    } finally {
      setEnviando(false)
    }
  }, [expedienteId, motivo, porEnviar, referencias])

  return { referencias, actualizar, motivo, setMotivo, porEnviar, referidas, referirSeleccionadas, enviando, error }
}

export type UseReferirAreas = ReturnType<typeof useReferirAreas>
