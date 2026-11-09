import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import { RENOVACION_RESERVA_CASO_MS } from '@akyuam/shared'
import { extraerMensajeError } from './errors'

export interface OperacionesReserva {
  /** Reserva o renueva; el servidor responde 409 si la tiene o la tomó otra persona. */
  reservar: () => Promise<unknown>
  /** Suelta la reserva propia al salir de la pantalla. */
  liberar: () => Promise<unknown>
  /** Igual que `liberar`, pero con una petición que sobrevive al cierre de la pestaña. */
  liberarAlCerrar: () => void
}

/** Respuestas que significan que la reserva ya no es nuestra; cualquier otra se reintenta. */
const SIN_RESERVA = new Set([403, 404, 409])

/**
 * Mantiene la reserva de una referencia mientras la pantalla está abierta, sin límite de tiempo:
 * la renueva cada `RENOVACION_RESERVA_CASO_MS` y al volver de una suspensión, de otra pestaña o
 * de quedarse sin internet. Si en ese rato otra persona la reservó o tomó el caso, `perdida` trae
 * el mensaje del servidor y la pantalla lo dice en ese momento. Al desmontarse o cerrar la
 * pestaña la suelta; si eso no llega (sin luz, sin red), vence sola en el servidor.
 *
 * `referidoId` null = no hay nada que reservar. Las operaciones pueden cambiar en cada render.
 */
export function useReservaCaso(referidoId: string | null, operaciones: OperacionesReserva) {
  // Con su referencia: si cambia la referencia, el aviso de la anterior deja de aplicar solo.
  const [perdida, setPerdida] = useState<{ referidoId: string; mensaje: string } | null>(null)
  const ops = useRef(operaciones)
  useEffect(() => {
    ops.current = operaciones
  })
  // Reservar y soltar van en fila: en StrictMode (montar, desmontar, montar) el último gana.
  const cola = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    if (!referidoId) return
    const id = referidoId
    let vigente = true

    function enFila(operacion: () => Promise<unknown>) {
      cola.current = cola.current.then(operacion, operacion)
    }

    function renovar() {
      if (!vigente) return
      enFila(async () => {
        try {
          await ops.current.reservar()
        } catch (err) {
          // Sin red o error pasajero: se intenta de nuevo en la próxima vuelta.
          if (!axios.isAxiosError(err) || !SIN_RESERVA.has(err.response?.status ?? 0)) return
          vigente = false
          window.clearInterval(intervalo)
          setPerdida({ referidoId: id, mensaje: extraerMensajeError(err) })
        }
      })
    }

    function alVolverAVerse() {
      if (document.visibilityState === 'visible') renovar()
    }
    function alCerrar() {
      if (vigente) ops.current.liberarAlCerrar()
    }

    const intervalo = window.setInterval(renovar, RENOVACION_RESERVA_CASO_MS)
    renovar()
    document.addEventListener('visibilitychange', alVolverAVerse)
    window.addEventListener('online', renovar)
    window.addEventListener('pageshow', renovar)
    window.addEventListener('pagehide', alCerrar)

    return () => {
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolverAVerse)
      window.removeEventListener('online', renovar)
      window.removeEventListener('pageshow', renovar)
      window.removeEventListener('pagehide', alCerrar)
      if (vigente) enFila(() => ops.current.liberar().catch(() => undefined))
      vigente = false
    }
  }, [referidoId])

  return { perdida: perdida?.referidoId === referidoId ? perdida.mensaje : null }
}
