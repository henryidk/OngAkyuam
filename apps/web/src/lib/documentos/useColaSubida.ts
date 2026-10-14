import { useCallback, useEffect, useRef, useState } from 'react'
import { CONCURRENCIA_SUBIDA, NOMBRE_DOCUMENTO_MAX } from '@akyuam/shared'
import { extraerMensajeError } from '../errors'
import { validarArchivoDocumento } from './archivoDocumento'

export type EstadoItem = 'pendiente' | 'subiendo' | 'listo' | 'error'
export type FaseCola = 'edicion' | 'subiendo' | 'resultado'

export interface ItemCola<R = unknown> {
  id: string
  archivo: File
  nombreVisible: string
  estado: EstadoItem
  progreso: number
  error: string | null
  /** Tipo o tamaño no permitidos: nunca se envía y no admite reintento. */
  invalido: boolean
  /** Lo que respondió el servidor al subirlo (p. ej. el id del documento); `null` mientras no termina. */
  resultado: R | null
}

export interface OpcionesSubidaCola<D> {
  /** Lo que se pasó a `iniciar`: la carpeta de Jurídico, el lote de Medicina… */
  destino: D
  /** Agrupa los archivos de un mismo envío. */
  tanda: string
  signal: AbortSignal
  onProgreso: (porcentaje: number) => void
}

/** Sube un archivo de la cola. Cada área decide a qué endpoint va. */
export type SubirArchivoCola<D, R> = (item: ItemCola<R>, opciones: OpcionesSubidaCola<D>) => Promise<R>

function nombreSinExtension(nombre: string, maximo: number): string {
  return nombre.replace(/\.[^.]+$/, '').slice(0, maximo)
}

/**
 * Cola de subida de un envío, compartida por las áreas que suben documentos: cada archivo es una
 * petición independiente (uno que falla no tumba a los demás), con `CONCURRENCIA_SUBIDA` a la
 * vez. Todas las peticiones de un `iniciar` comparten la misma `tanda`.
 */
export function useColaSubida<D, R = unknown>(subir: SubirArchivoCola<D, R>, nombreMaximo = NOMBRE_DOCUMENTO_MAX) {
  const [items, setItems] = useState<ItemCola<R>[]>([])
  const [fase, setFase] = useState<FaseCola>('edicion')
  // Espejo síncrono: los trabajadores leen la cola actual sin esperar al siguiente render.
  const espejo = useRef<ItemCola<R>[]>([])
  const controladores = useRef(new Map<string, AbortController>())
  const envio = useRef<{ destino: D; tanda: string } | null>(null)
  // `subir` suele ser una función nueva en cada render: se lee por ref.
  const subirActual = useRef(subir)
  useEffect(() => {
    subirActual.current = subir
  }, [subir])

  const actualizar = useCallback((cambio: (actuales: ItemCola<R>[]) => ItemCola<R>[]) => {
    espejo.current = cambio(espejo.current)
    setItems(espejo.current)
  }, [])

  const modificar = useCallback(
    (id: string, cambios: Partial<ItemCola<R>>) =>
      actualizar((actuales) => actuales.map((item) => (item.id === id ? { ...item, ...cambios } : item))),
    [actualizar],
  )

  // Al desmontar se cortan las subidas en curso: no quedan peticiones huérfanas.
  useEffect(() => {
    const activos = controladores.current
    return () => activos.forEach((controlador) => controlador.abort())
  }, [])

  const agregar = useCallback(
    (archivos: File[]) => {
      const nuevos = archivos.map((archivo): ItemCola<R> => {
        const error = validarArchivoDocumento(archivo)
        return {
          id: crypto.randomUUID(),
          archivo,
          nombreVisible: nombreSinExtension(archivo.name, nombreMaximo),
          estado: error ? 'error' : 'pendiente',
          progreso: 0,
          error,
          invalido: error !== null,
          resultado: null,
        }
      })
      actualizar((actuales) => [...actuales, ...nuevos])
      return nuevos
    },
    [actualizar, nombreMaximo],
  )

  const quitar = useCallback(
    (id: string) => {
      controladores.current.get(id)?.abort()
      actualizar((actuales) => actuales.filter((item) => item.id !== id))
    },
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
        const resultado = await subirActual.current(item, {
          destino: destino.destino,
          tanda: destino.tanda,
          signal: controlador.signal,
          onProgreso: (progreso) => modificar(id, { progreso }),
        })
        modificar(id, { estado: 'listo', progreso: 100, resultado })
      } catch (err) {
        modificar(id, {
          estado: 'error',
          error: controlador.signal.aborted ? 'Subida cancelada' : extraerMensajeError(err),
        })
      } finally {
        controladores.current.delete(id)
      }
    },
    [modificar],
  )

  const iniciar = useCallback(
    async (destino: D) => {
      envio.current = { destino, tanda: crypto.randomUUID() }
      const pendientes = espejo.current.filter((item) => item.estado === 'pendiente').map((item) => item.id)
      setFase('subiendo')
      const trabajador = async () => {
        for (let id = pendientes.shift(); id; id = pendientes.shift()) {
          // Si se canceló (o ya lo tomó otro trabajador) mientras esperaba su turno, se salta.
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
