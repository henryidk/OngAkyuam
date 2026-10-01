import { useCallback, useEffect, useRef, useState } from 'react'
import { CONCURRENCIA_SUBIDA, NOMBRE_DOCUMENTO_MAX } from '@akyuam/shared'
import { validarArchivoDocumento } from '../../../lib/documentos/archivoDocumento'
import { extraerMensajeError } from '../../../lib/errors'
import { subirDocumento } from '../api/juridico.api'

export type EstadoItem = 'pendiente' | 'subiendo' | 'listo' | 'error'
export type FaseCola = 'edicion' | 'subiendo' | 'resultado'

export interface ItemCola {
  id: string
  archivo: File
  nombreVisible: string
  estado: EstadoItem
  progreso: number
  error: string | null
  /** Tipo o tamaño no permitidos: nunca se envía y no admite reintento. */
  invalido: boolean
}

function nombreSinExtension(nombre: string): string {
  return nombre.replace(/\.[^.]+$/, '').slice(0, NOMBRE_DOCUMENTO_MAX)
}

/**
 * Cola de subida de un envío: cada archivo es una petición independiente (uno que falla no tumba
 * a los demás), con `CONCURRENCIA_SUBIDA` a la vez. Todas las peticiones de un envío comparten
 * la misma `tanda`, que el backend usa para escribir una sola entrada de bitácora.
 */
export function useColaSubida(procesoId: string) {
  const [items, setItems] = useState<ItemCola[]>([])
  const [fase, setFase] = useState<FaseCola>('edicion')
  // Espejo síncrono: los trabajadores leen la cola actual sin esperar al siguiente render.
  const espejo = useRef<ItemCola[]>([])
  const controladores = useRef(new Map<string, AbortController>())
  const envio = useRef<{ carpetaId: string; tanda: string } | null>(null)

  const actualizar = useCallback((cambio: (actuales: ItemCola[]) => ItemCola[]) => {
    espejo.current = cambio(espejo.current)
    setItems(espejo.current)
  }, [])

  const modificar = useCallback(
    (id: string, cambios: Partial<ItemCola>) =>
      actualizar((actuales) => actuales.map((item) => (item.id === id ? { ...item, ...cambios } : item))),
    [actualizar],
  )

  // Al cerrar el modal se cortan las subidas en curso: no quedan peticiones huérfanas.
  useEffect(() => {
    const activos = controladores.current
    return () => activos.forEach((controlador) => controlador.abort())
  }, [])

  const agregar = useCallback(
    (archivos: File[]) => {
      const nuevos = archivos.map((archivo): ItemCola => {
        const error = validarArchivoDocumento(archivo)
        return {
          id: crypto.randomUUID(),
          archivo,
          nombreVisible: nombreSinExtension(archivo.name),
          estado: error ? 'error' : 'pendiente',
          progreso: 0,
          error,
          invalido: error !== null,
        }
      })
      actualizar((actuales) => [...actuales, ...nuevos])
    },
    [actualizar],
  )

  const quitar = useCallback(
    (id: string) => actualizar((actuales) => actuales.filter((item) => item.id !== id)),
    [actualizar],
  )

  const renombrar = useCallback((id: string, nombreVisible: string) => modificar(id, { nombreVisible }), [modificar])

  const subirUno = useCallback(
    async (id: string) => {
      const item = espejo.current.find((actual) => actual.id === id)
      const destino = envio.current
      if (!item || !destino || item.invalido) return
      const controlador = new AbortController()
      controladores.current.set(id, controlador)
      modificar(id, { estado: 'subiendo', progreso: 0, error: null })
      try {
        await subirDocumento(procesoId, destino.carpetaId, item.archivo, item.nombreVisible.trim(), {
          tanda: destino.tanda,
          signal: controlador.signal,
          onProgreso: (progreso) => modificar(id, { progreso }),
        })
        modificar(id, { estado: 'listo', progreso: 100 })
      } catch (err) {
        modificar(id, {
          estado: 'error',
          error: controlador.signal.aborted ? 'Subida cancelada' : extraerMensajeError(err),
        })
      } finally {
        controladores.current.delete(id)
      }
    },
    [procesoId, modificar],
  )

  const iniciar = useCallback(
    async (carpetaId: string) => {
      envio.current = { carpetaId, tanda: crypto.randomUUID() }
      const pendientes = espejo.current.filter((item) => item.estado === 'pendiente').map((item) => item.id)
      setFase('subiendo')
      const trabajador = async () => {
        for (let id = pendientes.shift(); id; id = pendientes.shift()) {
          // Si se canceló mientras esperaba su turno, ya no está pendiente: se salta.
          if (espejo.current.find((item) => item.id === id)?.estado === 'pendiente') await subirUno(id)
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCIA_SUBIDA }, trabajador))
      setFase('resultado')
    },
    [subirUno],
  )

  const reintentar = useCallback(
    async (id: string) => {
      setFase('subiendo')
      await subirUno(id)
      setFase('resultado')
    },
    [subirUno],
  )

  const cancelar = useCallback(() => {
    // Los que aún no empezaron se marcan primero, para que ningún trabajador los tome.
    actualizar((actuales) =>
      actuales.map((item) =>
        item.estado === 'pendiente' ? { ...item, estado: 'error', error: 'Subida cancelada' } : item,
      ),
    )
    controladores.current.forEach((controlador) => controlador.abort())
  }, [actualizar])

  return { items, fase, agregar, quitar, renombrar, iniciar, reintentar, cancelar }
}
