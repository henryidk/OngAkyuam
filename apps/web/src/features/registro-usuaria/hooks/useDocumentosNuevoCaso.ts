import { useCallback, useRef, useState } from 'react'
import type { AreaAtencion, TipoDocumentoTrabajoSocial } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { validarArchivoDocumento } from '../../../lib/documentos/archivoDocumento'
import {
  actualizarAccesoArea,
  subirDocumentoCaso,
  subirVersionDocumento,
} from '../../trabajo-social/api/trabajoSocial.api'

/**
 * Un escaneo del paso "Documentos", que ya va directo al caso creado.
 *
 * - `subiendo`: `progreso` de 0 a 100, o `null` al reemplazar (esa subida no informa avance).
 * - `subido`: ya es documento del caso; `documentoId` sirve para reemplazarlo por otra versión.
 * - `error`: no se subió. `reintentable` es falso cuando el archivo en sí no sirve (tipo o
 *   tamaño) — reintentar daría el mismo error, hay que elegir otro.
 *
 * `documentoId` se conserva en `subiendo`/`error` cuando lo que falló fue un reemplazo: el
 * documento anterior sigue en el caso y el siguiente intento debe ser otra versión, no uno nuevo.
 */
export type DocumentoNuevoCaso = { tipo: TipoDocumentoTrabajoSocial; archivo: File; documentoId?: string } & (
  | { estado: 'subiendo'; progreso: number | null }
  | { estado: 'subido'; documentoId: string }
  | { estado: 'error'; mensajeError: string; reintentable: boolean }
)

type PorTipo<T> = Partial<Record<TipoDocumentoTrabajoSocial, T>>

/**
 * Sube los escaneos al caso recién registrado y decide, por documento, qué áreas referidas lo
 * ven. Todo nace privado (solo Trabajo Social); Jurídico no aparece porque ve los formularios
 * de Trabajo Social por normativa.
 *
 * Antes de subir, los switches solo marcan con qué áreas se compartirá; después de subir, cada
 * cambio se guarda en el momento, igual que la matriz de Accesos de la ficha.
 */
export function useDocumentosNuevoCaso(expedienteId: string) {
  const [documentos, setDocumentos] = useState<PorTipo<DocumentoNuevoCaso>>({})
  const [visibilidad, setVisibilidad] = useState<PorTipo<AreaAtencion[]>>({})
  const [errorVisibilidad, setErrorVisibilidad] = useState<string | null>(null)
  /** Ref y no estado: el `.then` de una subida necesita saber si sigue siendo la vigente de su tipo. */
  const subidaVigente = useRef(new Map<TipoDocumentoTrabajoSocial, symbol>())

  const subir = useCallback(
    (tipo: TipoDocumentoTrabajoSocial, archivo: File, documentoId: string | undefined, areasVisibles: AreaAtencion[]) => {
      const marca = Symbol(tipo)
      subidaVigente.current.set(tipo, marca)
      const esVigente = () => subidaVigente.current.get(tipo) === marca
      setDocumentos((actual) => ({
        ...actual,
        [tipo]: { tipo, archivo, documentoId, estado: 'subiendo', progreso: documentoId ? null : 0 },
      }))

      const peticion = documentoId
        ? subirVersionDocumento(expedienteId, documentoId, archivo)
        : subirDocumentoCaso(expedienteId, tipo, archivo, {
            areasVisibles,
            onProgreso: (progreso) => {
              if (!esVigente()) return
              setDocumentos((actual) => {
                const documento = actual[tipo]
                if (documento?.estado !== 'subiendo') return actual
                return { ...actual, [tipo]: { ...documento, progreso } }
              })
            },
          })

      peticion
        .then((subido) => {
          if (!esVigente()) return
          setDocumentos((actual) => ({
            ...actual,
            // Al reemplazar, el documento sigue siendo el mismo: su id no cambia con la versión.
            [tipo]: { tipo, archivo, estado: 'subido', documentoId: documentoId ?? subido.id },
          }))
        })
        .catch((err: unknown) => {
          if (!esVigente()) return
          setDocumentos((actual) => ({
            ...actual,
            [tipo]: { tipo, archivo, documentoId, estado: 'error', mensajeError: extraerMensajeError(err), reintentable: true },
          }))
        })
    },
    [expedienteId],
  )

  const seleccionarArchivo = useCallback(
    (tipo: TipoDocumentoTrabajoSocial, archivo: File) => {
      const anterior = documentos[tipo]
      const documentoId = anterior?.documentoId
      const invalido = validarArchivoDocumento(archivo)
      if (invalido) {
        setDocumentos((actual) => ({
          ...actual,
          [tipo]: { tipo, archivo, documentoId, estado: 'error', mensajeError: invalido, reintentable: false },
        }))
        return
      }
      subir(tipo, archivo, documentoId, visibilidad[tipo] ?? [])
    },
    [documentos, subir, visibilidad],
  )

  const reintentar = useCallback(
    (tipo: TipoDocumentoTrabajoSocial) => {
      const documento = documentos[tipo]
      if (documento?.estado === 'error' && documento.reintentable) {
        subir(tipo, documento.archivo, documento.documentoId, visibilidad[tipo] ?? [])
      }
    },
    [documentos, subir, visibilidad],
  )

  const alternarVisibilidad = useCallback(
    async (tipo: TipoDocumentoTrabajoSocial, area: AreaAtencion, visible: boolean) => {
      const previas = visibilidad[tipo] ?? []
      const nuevas = visible ? [...new Set([...previas, area])] : previas.filter((actual) => actual !== area)
      setErrorVisibilidad(null)
      setVisibilidad((actual) => ({ ...actual, [tipo]: nuevas }))
      // Sin subir todavía, solo se recuerda para enviarlo junto con el archivo.
      if (documentos[tipo]?.estado !== 'subido') return
      try {
        await actualizarAccesoArea(expedienteId, area, { documentos: { [tipo]: visible } })
      } catch (err) {
        setVisibilidad((actual) => ({ ...actual, [tipo]: previas }))
        setErrorVisibilidad(extraerMensajeError(err))
      }
    },
    [documentos, expedienteId, visibilidad],
  )

  const lista = Object.values(documentos)
  const haySubidasEnCurso = lista.some((documento) => documento.estado === 'subiendo')
  const subidos = lista.filter((documento) => documento.estado === 'subido').map((documento) => documento.tipo)

  return {
    documentos,
    visibilidad,
    errorVisibilidad,
    haySubidasEnCurso,
    subidos,
    seleccionarArchivo,
    reintentar,
    alternarVisibilidad,
  }
}

export type UseDocumentosNuevoCaso = ReturnType<typeof useDocumentosNuevoCaso>
