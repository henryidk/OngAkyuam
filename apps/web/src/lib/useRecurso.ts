import axios from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'
import { extraerMensajeError } from './errors'

interface ErrorRecurso {
  mensaje: string
  /** 403: la pantalla muestra "sin acceso" en vez de un error con reintento. */
  sinPermiso: boolean
}

/**
 * Carga de un recurso remoto con los estados que toda vista del módulo debe pintar (§5.5 del
 * plan): cargando, error con reintento y sin permiso. `cargar` debe venir memorizada con
 * `useCallback`: cuando cambia (otro id, otro filtro) se vuelve a pedir desde cero. `recargar`
 * en cambio conserva lo que ya se ve mientras llega la versión nueva, para no desmontar la
 * pantalla —ni el modal abierto— después de cada acción.
 */
export function useRecurso<T>(cargar: () => Promise<T>) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<ErrorRecurso | null>(null)
  const [cargando, setCargando] = useState(true)
  // Solo cuenta la respuesta de la última petición: evita que una vieja pise a una nueva.
  const turno = useRef(0)

  const pedir = useCallback(
    async (conservar: boolean) => {
      const miTurno = ++turno.current
      if (!conservar) setDatos(null)
      setError(null)
      setCargando(true)
      try {
        const respuesta = await cargar()
        if (miTurno === turno.current) setDatos(respuesta)
      } catch (err) {
        if (miTurno !== turno.current) return
        setError({
          mensaje: extraerMensajeError(err),
          sinPermiso: axios.isAxiosError(err) && err.response?.status === 403,
        })
      } finally {
        if (miTurno === turno.current) setCargando(false)
      }
    },
    [cargar],
  )

  useEffect(() => {
    void pedir(false)
  }, [pedir])

  const recargar = useCallback(() => pedir(true), [pedir])

  return { datos, error, cargando, recargar }
}
