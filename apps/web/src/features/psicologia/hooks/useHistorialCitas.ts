import { useCallback, useEffect, useState } from 'react'
import type { CitaResumen, EstadoCitaPsicologica } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { listarHistorialCitas } from '../api/psicologia.api'

export function useHistorialCitas(expedienteId: string, estado?: EstadoCitaPsicologica) {
  const [citas, setCitas] = useState<CitaResumen[] | null>(null)
  const [siguienteCursor, setSiguienteCursor] = useState<string | null>(null)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    setCitas(null)
    setSiguienteCursor(null)
    setError(null)
    try {
      const pagina = await listarHistorialCitas(expedienteId, { estado })
      setCitas(pagina.items)
      setSiguienteCursor(pagina.siguienteCursor)
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [expedienteId, estado])

  useEffect(() => {
    void recargar()
  }, [recargar])

  async function cargarMas() {
    if (!siguienteCursor) return
    setCargandoMas(true)
    try {
      const pagina = await listarHistorialCitas(expedienteId, { estado, cursor: siguienteCursor })
      setCitas((actuales) => [...(actuales ?? []), ...pagina.items])
      setSiguienteCursor(pagina.siguienteCursor)
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setCargandoMas(false)
    }
  }

  return { citas, error, siguienteCursor, cargandoMas, recargar, cargarMas }
}
