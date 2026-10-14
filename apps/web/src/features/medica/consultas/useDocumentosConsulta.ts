import { useCallback, useRef, useState } from 'react'
import { NOMBRE_DOCUMENTO_MEDICO_MAX, type DocumentoMedicoSubidoDto, type TipoDocumentoMedico } from '@akyuam/shared'
import { useToast } from '../../../components/ui/Toast'
import { esImagen } from '../../../lib/documentos/archivoDocumento'
import { useColaSubida, type ItemCola } from '../../../lib/documentos/useColaSubida'
import { extraerMensajeError } from '../../../lib/errors'
import { subirDocumentoPendiente, cambiarTipoPendiente, eliminarPendiente } from '../api/medica.api'

interface DestinoMedico {
  lote: string
  atencionId: string
}

export type ItemDocumento = ItemCola<DocumentoMedicoSubidoDto>

/**
 * Documentos de la consulta que se está registrando. Cada archivo se sube en cuanto se elige a un
 * "lote" pendiente; al guardar la consulta, el backend los asocia con ella. Si la consulta nunca
 * se guarda, el lote queda huérfano y el backend lo limpia.
 */
export function useDocumentosConsulta(atencionId: string | null) {
  const { mostrar } = useToast()
  // Un lote por formulario: no cambia entre renders ni al reintentar el guardado.
  const [lote] = useState(() => crypto.randomUUID())
  const [tipos, setTipos] = useState<Record<string, TipoDocumentoMedico>>({})
  // `subir` lee el tipo por ref: el usuario puede cambiarlo mientras el archivo espera turno.
  const tiposRef = useRef(tipos)
  const fijarTipos = useCallback((cambios: Record<string, TipoDocumentoMedico>) => {
    tiposRef.current = { ...tiposRef.current, ...cambios }
    setTipos(tiposRef.current)
  }, [])

  const subir = useCallback(
    (item: ItemDocumento, { destino, signal, onProgreso }: { destino: DestinoMedico; signal: AbortSignal; onProgreso: (p: number) => void }) =>
      subirDocumentoPendiente(
        item.archivo,
        {
          lote: destino.lote,
          atencionId: destino.atencionId,
          tipo: tiposRef.current[item.id] ?? 'OTRO',
          nombreVisible: item.nombreVisible,
        },
        { signal, onProgreso },
      ),
    [],
  )
  const cola = useColaSubida<DestinoMedico, DocumentoMedicoSubidoDto>(subir, NOMBRE_DOCUMENTO_MEDICO_MAX)
  const { agregar, iniciar, quitar, reintentar } = cola

  const adjuntar = useCallback(
    (archivos: File[]) => {
      if (!atencionId || archivos.length === 0) return
      const nuevos = agregar(archivos)
      const tiposNuevos: Record<string, TipoDocumentoMedico> = {}
      for (const item of nuevos) tiposNuevos[item.id] = esImagen(item.archivo.type) ? 'IMAGEN' : 'RESULTADO_LABORATORIO'
      fijarTipos(tiposNuevos)
      void iniciar({ lote, atencionId })
    },
    [agregar, iniciar, fijarTipos, lote, atencionId],
  )

  const cambiarTipo = useCallback(
    async (item: ItemDocumento, tipo: TipoDocumentoMedico) => {
      const anterior = tiposRef.current[item.id]
      fijarTipos({ [item.id]: tipo })
      if (item.estado !== 'listo' || !item.resultado) return
      try {
        await cambiarTipoPendiente(item.resultado.id, tipo)
      } catch (err) {
        fijarTipos({ [item.id]: anterior })
        mostrar(extraerMensajeError(err), 'error')
      }
    },
    [fijarTipos, mostrar],
  )

  const eliminar = useCallback(
    async (item: ItemDocumento) => {
      if (item.estado === 'listo' && item.resultado) {
        try {
          await eliminarPendiente(item.resultado.id)
        } catch (err) {
          mostrar(extraerMensajeError(err), 'error')
          return
        }
      }
      quitar(item.id)
    },
    [quitar, mostrar],
  )

  const items = cola.items
  return {
    lote,
    items,
    tipos,
    adjuntar,
    cambiarTipo,
    eliminar,
    reintentar,
    subiendo: items.some((item) => item.estado === 'pendiente' || item.estado === 'subiendo'),
    conError: items.some((item) => item.estado === 'error'),
    hayListos: items.some((item) => item.estado === 'listo'),
  }
}

export type DocumentosConsultaEstado = ReturnType<typeof useDocumentosConsulta>
