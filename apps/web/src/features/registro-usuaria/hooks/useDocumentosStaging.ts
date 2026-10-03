import axios from 'axios'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DOCUMENTO_TAMANIO_MAXIMO_BYTES,
  mimeTypePermitido,
  tipoDocumentoAplicaARegistro,
  type TipoDocumentoTrabajoSocial,
  type TipoRegistro,
} from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { descartarDocumentoPendiente, subirDocumentoPendiente } from '../../trabajo-social/api/trabajoSocial.api'

/**
 * Un archivo elegido en el paso "Documentos". Sin visibilidad por área: todo documento nace
 * privado para Trabajo Social y se comparte después, al referir o desde la pestaña Accesos.
 *
 * - `subiendo`: va camino al servidor (`progreso` de 0 a 100).
 * - `subido`: ya está guardado; `pendienteId` es lo que se envía al registrar.
 * - `error`: no se subió. `reintentable` es falso cuando el archivo en sí no sirve (tipo o
 *   tamaño) — ahí reintentar daría el mismo error, hay que elegir otro.
 */
export type DocumentoRegistro = { tipo: TipoDocumentoTrabajoSocial; archivo: File } & (
  | { estado: 'subiendo'; progreso: number }
  | { estado: 'subido'; pendienteId: string }
  | { estado: 'error'; mensajeError: string; reintentable: boolean }
)

type DocumentosPorTipo = Partial<Record<TipoDocumentoTrabajoSocial, DocumentoRegistro>>

/**
 * Sube cada escaneo en cuanto se elige, mientras el expediente todavía no existe: el progreso y
 * los errores se ven en el mismo paso "Documentos", no después de registrar. Al registrar, el
 * wizard envía `idsParaRegistrar(...)` y el servidor los adjunta al caso en la misma transacción.
 *
 * Lo que se sube y no termina en un caso (se quitó, se cambió, o se salió del wizard sin
 * registrar) se borra del servidor en el momento; si el navegador se cierra de golpe, la
 * limpieza automática del servidor lo borra al día siguiente.
 */
export function useDocumentosStaging() {
  const [documentosPorTipo, setDocumentosPorTipo] = useState<DocumentosPorTipo>({})

  // Refs y no estado: se leen en callbacks asíncronos y al desmontar, donde el estado ya no está al día.
  /** Subidas en curso, para cancelarlas si se cambia o quita el archivo. */
  const subidasEnCurso = useRef(new Map<TipoDocumentoTrabajoSocial, AbortController>())
  /** Lo que ya está en el servidor y todavía no forma parte de un caso. */
  const pendientesSinAdjuntar = useRef(new Map<TipoDocumentoTrabajoSocial, string>())
  const montado = useRef(true)

  const descartarEnServidor = useCallback((pendienteId: string) => {
    // Mejor esfuerzo: si falla, la limpieza automática del servidor lo borra igual.
    descartarDocumentoPendiente(pendienteId).catch(() => undefined)
  }, [])

  /** Cancela la subida en curso y borra del servidor lo ya subido para este tipo. */
  const liberarTipo = useCallback(
    (tipo: TipoDocumentoTrabajoSocial) => {
      subidasEnCurso.current.get(tipo)?.abort()
      subidasEnCurso.current.delete(tipo)
      const pendienteId = pendientesSinAdjuntar.current.get(tipo)
      if (pendienteId) {
        pendientesSinAdjuntar.current.delete(tipo)
        descartarEnServidor(pendienteId)
      }
    },
    [descartarEnServidor],
  )

  const subir = useCallback(
    (tipo: TipoDocumentoTrabajoSocial, archivo: File) => {
      const controlador = new AbortController()
      subidasEnCurso.current.set(tipo, controlador)
      setDocumentosPorTipo((actual) => ({ ...actual, [tipo]: { tipo, archivo, estado: 'subiendo', progreso: 0 } }))

      // Solo actualiza la pantalla si esta sigue siendo la subida vigente de ese tipo.
      const esVigente = () => montado.current && subidasEnCurso.current.get(tipo) === controlador

      subirDocumentoPendiente(
        tipo,
        archivo,
        (progreso) => {
          if (!esVigente()) return
          setDocumentosPorTipo((actual) => {
            const documento = actual[tipo]
            if (documento?.estado !== 'subiendo') return actual
            return { ...actual, [tipo]: { ...documento, progreso } }
          })
        },
        controlador.signal,
      )
        .then((subido) => {
          if (!esVigente()) {
            // Llegó tarde: ya se cambió, se quitó o se salió del wizard. No debe quedar en el servidor.
            descartarEnServidor(subido.id)
            return
          }
          subidasEnCurso.current.delete(tipo)
          pendientesSinAdjuntar.current.set(tipo, subido.id)
          setDocumentosPorTipo((actual) => ({
            ...actual,
            [tipo]: { tipo, archivo, estado: 'subido', pendienteId: subido.id },
          }))
        })
        .catch((err: unknown) => {
          if (axios.isCancel(err) || !esVigente()) return
          subidasEnCurso.current.delete(tipo)
          setDocumentosPorTipo((actual) => ({
            ...actual,
            [tipo]: { tipo, archivo, estado: 'error', mensajeError: extraerMensajeError(err), reintentable: true },
          }))
        })
    },
    [descartarEnServidor],
  )

  const seleccionarArchivo = useCallback(
    (tipo: TipoDocumentoTrabajoSocial, archivo: File) => {
      liberarTipo(tipo)
      const error = validarArchivo(archivo)
      if (error) {
        setDocumentosPorTipo((actual) => ({
          ...actual,
          [tipo]: { tipo, archivo, estado: 'error', mensajeError: error, reintentable: false },
        }))
        return
      }
      subir(tipo, archivo)
    },
    [liberarTipo, subir],
  )

  const reintentar = useCallback(
    (tipo: TipoDocumentoTrabajoSocial) => {
      const documento = documentosPorTipo[tipo]
      if (documento?.estado === 'error' && documento.reintentable) {
        subir(tipo, documento.archivo)
      }
    },
    [documentosPorTipo, subir],
  )

  const quitarArchivo = useCallback(
    (tipo: TipoDocumentoTrabajoSocial) => {
      liberarTipo(tipo)
      setDocumentosPorTipo((actual) => {
        const { [tipo]: _quitado, ...resto } = actual
        return resto
      })
    },
    [liberarTipo],
  )

  /**
   * Lo que se envía al registrar: solo lo ya subido y que aplica al tipo de registro actual
   * (si se subió un documento de albergue y luego se cambió a Externa, no se adjunta).
   */
  const idsParaRegistrar = useCallback(
    (tipoRegistro: TipoRegistro) =>
      Object.values(documentosPorTipo)
        .filter((documento) => tipoDocumentoAplicaARegistro(documento.tipo, tipoRegistro))
        .flatMap((documento) => (documento.estado === 'subido' ? [documento.pendienteId] : [])),
    [documentosPorTipo],
  )

  /** Tras registrar: estos ya son documentos del caso — nunca se descartan al salir. */
  const marcarAdjuntados = useCallback((ids: string[]) => {
    for (const [tipo, pendienteId] of pendientesSinAdjuntar.current) {
      if (ids.includes(pendienteId)) {
        pendientesSinAdjuntar.current.delete(tipo)
      }
    }
  }, [])

  useEffect(() => {
    montado.current = true
    const subidas = subidasEnCurso.current
    const pendientes = pendientesSinAdjuntar.current
    return () => {
      // Salir del wizard sin registrar (o con documentos que no entraron al caso): no deben
      // quedar escaneos sueltos en el servidor.
      montado.current = false
      for (const controlador of subidas.values()) controlador.abort()
      subidas.clear()
      for (const pendienteId of pendientes.values()) descartarEnServidor(pendienteId)
      pendientes.clear()
    }
  }, [descartarEnServidor])

  const documentos = useMemo(() => Object.values(documentosPorTipo), [documentosPorTipo])
  const haySubidasEnCurso = documentos.some((documento) => documento.estado === 'subiendo')

  return {
    documentosPorTipo,
    documentos,
    haySubidasEnCurso,
    seleccionarArchivo,
    quitarArchivo,
    reintentar,
    idsParaRegistrar,
    marcarAdjuntados,
  }
}

export type UseDocumentosStaging = ReturnType<typeof useDocumentosStaging>

function validarArchivo(archivo: File): string | undefined {
  if (!mimeTypePermitido(archivo.type)) {
    return 'Tipo de archivo no permitido. Usa PDF, JPG, PNG o WEBP.'
  }
  if (archivo.size > DOCUMENTO_TAMANIO_MAXIMO_BYTES) {
    return 'El archivo supera el tamaño máximo permitido (15 MB).'
  }
  return undefined
}
