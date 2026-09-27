import { useRef, useState, type ChangeEvent } from 'react'
import type { FilaDocumentoCaso } from '@akyuam/shared'
import DrawerDocumento from '../../documentos/DrawerDocumento'
import FilaDocumento from '../../documentos/FilaDocumento'
import { ACCEPT_DOCUMENTOS } from '../../documentos/archivoDocumento'
import { useDocumentosCaso } from '../../documentos/useDocumentosCaso'

interface PestanaDocumentosProps {
  expedienteId: string
}

function EsqueletoFilas() {
  return (
    <ul>
      {[0, 1, 2].map((indice) => (
        <li key={indice} className="flex items-center gap-3 border-t border-gray-100 px-5 py-3.5">
          <div className="h-11 w-9 animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-48 animate-pulse rounded bg-gray-100" />
        </li>
      ))}
    </ul>
  )
}

export default function PestanaDocumentos({ expedienteId }: PestanaDocumentosProps) {
  const { documentos, error, subirArchivo, tipoEnSubida, errorSubida } = useDocumentosCaso(expedienteId)
  const [tipoAbierto, setTipoAbierto] = useState<FilaDocumentoCaso['tipo'] | null>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)
  // Un solo <input type="file"> para toda la pestaña: se recuerda para qué fila se abrió.
  const filaDestino = useRef<FilaDocumentoCaso | null>(null)

  // Se busca por tipo (no por id) para que el drawer siga la versión nueva tras "Subir nueva versión".
  const filaAbierta = documentos?.filas.find((fila) => fila.tipo === tipoAbierto) ?? null

  function elegirArchivo(fila: FilaDocumentoCaso) {
    filaDestino.current = fila
    inputArchivo.current?.click()
  }

  async function onArchivoElegido(event: ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0]
    // Se limpia para que volver a elegir el mismo archivo tras un error dispare `change`.
    event.target.value = ''
    const fila = filaDestino.current
    if (!archivo || !fila) return
    await subirArchivo(fila, archivo)
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="px-5 py-4">
        <h2 className="text-[15px] font-semibold text-gray-900">Documentos físicos escaneados</h2>
        <p className="mt-1 text-[13px] text-gray-500">
          El original en papel se archiva; aquí vive la copia digital. Reemplazar conserva la versión anterior.
        </p>
      </div>

      {error && (
        <p className="mx-5 mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {errorSubida && !filaAbierta && (
        <p className="mx-5 mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorSubida}
        </p>
      )}

      {!documentos && !error && <EsqueletoFilas />}

      {documentos && (
        <ul>
          {documentos.filas.map((fila) => (
            <FilaDocumento
              key={fila.tipo}
              fila={fila}
              subiendo={tipoEnSubida === fila.tipo}
              bloqueada={tipoEnSubida !== null && tipoEnSubida !== fila.tipo}
              onVer={() => setTipoAbierto(fila.tipo)}
              onElegirArchivo={() => elegirArchivo(fila)}
            />
          ))}
        </ul>
      )}

      <input
        ref={inputArchivo}
        type="file"
        accept={ACCEPT_DOCUMENTOS}
        className="hidden"
        onChange={(event) => void onArchivoElegido(event)}
      />

      {documentos && (
        <DrawerDocumento
          expedienteId={expedienteId}
          numeroExpediente={documentos.numero}
          fila={filaAbierta}
          subiendo={filaAbierta !== null && tipoEnSubida === filaAbierta.tipo}
          errorSubida={errorSubida}
          onSubirVersion={() => filaAbierta && elegirArchivo(filaAbierta)}
          onCerrar={() => setTipoAbierto(null)}
        />
      )}
    </section>
  )
}
