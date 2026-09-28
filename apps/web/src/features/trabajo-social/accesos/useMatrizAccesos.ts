import { useCallback, useEffect, useState } from 'react'
import type { AreaAtencion, MatrizAccesos } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { actualizarAccesoArea, obtenerMatrizAccesos } from '../api/trabajoSocial.api'
import { cambioDeCelda, conCeldaCambiada, type ClaveFilaAcceso } from './matrizAccesos'

/**
 * Matriz de accesos con guardado al momento: el switch cambia en pantalla antes de que responda
 * el backend y, si falla, se revierte solo esa celda (no toda la matriz, por si hay otro cambio
 * en curso).
 */
export function useMatrizAccesos(expedienteId: string) {
  const [matriz, setMatriz] = useState<MatrizAccesos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorCambio, setErrorCambio] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    setError(null)
    try {
      setMatriz(await obtenerMatrizAccesos(expedienteId))
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [expedienteId])

  useEffect(() => {
    setMatriz(null)
    void recargar()
  }, [recargar])

  const cambiar = useCallback(
    async (clave: ClaveFilaAcceso, area: AreaAtencion, visible: boolean) => {
      setErrorCambio(null)
      setMatriz((actual) => actual && conCeldaCambiada(actual, clave, area, visible))
      try {
        setMatriz(await actualizarAccesoArea(expedienteId, area, cambioDeCelda(clave, visible)))
      } catch (err) {
        setMatriz((actual) => actual && conCeldaCambiada(actual, clave, area, !visible))
        setErrorCambio(extraerMensajeError(err))
      }
    },
    [expedienteId],
  )

  return { matriz, error, errorCambio, recargar, cambiar }
}
