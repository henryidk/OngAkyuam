import { useCallback, useEffect, useState } from 'react'
import type { BandejaTs } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { crearSocketArea } from '../../../lib/socket'
import { obtenerBandeja } from '../api/trabajoSocial.api'

/** Un registro sube varios documentos seguidos: se espera a que termine la ráfaga antes de pedir. */
const ESPERA_REFRESCO_MS = 400

/**
 * Bandeja de Inicio. El socket solo avisa "algo cambió" (`bandeja:cambio`, sin datos): la
 * bandeja se vuelve a pedir por HTTP, así ningún dato de la usuaria viaja por el socket.
 */
export function useBandeja() {
  const [bandeja, setBandeja] = useState<BandejaTs | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    try {
      setBandeja(await obtenerBandeja())
      setError(null)
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  useEffect(() => {
    const socket = crearSocketArea()
    let temporizador: ReturnType<typeof setTimeout> | undefined
    let yaConectado = false

    function programarRecarga() {
      clearTimeout(temporizador)
      temporizador = setTimeout(() => void recargar(), ESPERA_REFRESCO_MS)
    }

    socket.on('bandeja:cambio', programarRecarga)
    // Tras una reconexión se pudo haber perdido algún aviso: se recarga una vez.
    socket.on('connect', () => {
      if (yaConectado) programarRecarga()
      yaConectado = true
    })
    // Si el servidor corta (p. ej. se reinició), socket.io no reintenta solo: se reconecta a mano.
    socket.on('disconnect', (motivo) => {
      if (motivo === 'io server disconnect') socket.connect()
    })

    return () => {
      clearTimeout(temporizador)
      socket.disconnect()
    }
  }, [recargar])

  return { bandeja, error, recargar }
}
