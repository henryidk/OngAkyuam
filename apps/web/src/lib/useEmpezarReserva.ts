import axios from 'axios'
import { useCallback, useState } from 'react'
import { extraerMensajeError } from './errors'

interface DespuesDeReservar {
  /** La referencia quedó reservada a nombre de quien la pidió: ya se puede agendar o atender. */
  alReservar: () => void
  /** Otra persona la reservó o la tomó primero (403/409): la lista que se ve ya no es cierta. */
  alPerderla: () => void
}

/**
 * Primer paso de "agendar la primera cita" o "atender ahora" desde el Área de atención: reservar
 * la referencia antes de abrir la pantalla, para que nadie más la empiece a la vez. Este hook solo
 * se ocupa de la llamada y de sus estados; qué pasa después lo decide la pantalla.
 */
export function useEmpezarReserva() {
  const [reservandoId, setReservandoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const empezar = useCallback(
    async (referidoId: string, reservar: () => Promise<unknown>, { alReservar, alPerderla }: DespuesDeReservar) => {
      setError(null)
      setReservandoId(referidoId)
      try {
        await reservar()
        alReservar()
      } catch (err) {
        setError(extraerMensajeError(err))
        const estado = axios.isAxiosError(err) ? err.response?.status : undefined
        if (estado === 403 || estado === 409) alPerderla()
      } finally {
        setReservandoId(null)
      }
    },
    [],
  )

  return { reservandoId, error, empezar }
}
