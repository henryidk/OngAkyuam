import { ETIQUETAS_TIPO_DOCUMENTO, type FilaDocumentoCaso } from '@akyuam/shared'
import Badge from '../../../components/ui/Badge'
import Button from '../../../components/ui/Button'
import Drawer from '../../../components/ui/Drawer'
import { esImagen, metaVersion } from './archivoDocumento'
import { useDescargaDocumento } from './useDescargaDocumento'
import { useVersionesDocumento } from './useVersionesDocumento'

interface DrawerDocumentoProps {
  expedienteId: string
  numeroExpediente: string
  /** `null` cierra el drawer. Solo se abre sobre filas con versión vigente. */
  fila: FilaDocumentoCaso | null
  subiendo: boolean
  errorSubida: string | null
  onSubirVersion: () => void
  onCerrar: () => void
}

function VistaPrevia({ url, mimeType, titulo }: { url: string | null; mimeType: string; titulo: string }) {
  return (
    <div className="aspect-[8.5/11] overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      {url &&
        (esImagen(mimeType) ? (
          <img src={url} alt={`Escaneo de ${titulo}`} className="h-full w-full object-contain" referrerPolicy="no-referrer" />
        ) : (
          <iframe src={url} title={`Vista previa de ${titulo}`} className="h-full w-full" referrerPolicy="no-referrer" />
        ))}
    </div>
  )
}

export default function DrawerDocumento({
  expedienteId,
  numeroExpediente,
  fila,
  subiendo,
  errorSubida,
  onSubirVersion,
  onCerrar,
}: DrawerDocumentoProps) {
  const vigente = fila?.vigente ?? null
  const { versiones, urlVistaPrevia, error } = useVersionesDocumento(expedienteId, vigente?.id ?? null)
  const { descargar, descargandoId, errorDescarga } = useDescargaDocumento(expedienteId)

  if (!fila || !vigente) return null
  const titulo = ETIQUETAS_TIPO_DOCUMENTO[fila.tipo]

  return (
    <Drawer
      abierto
      titulo={titulo}
      subtitulo={`Expediente ${numeroExpediente} · v${vigente.version} · ${metaVersion(vigente)}`}
      onCerrar={onCerrar}
      pie={
        <>
          <Button variante="secondary" tamano="md" onClick={onSubirVersion} cargando={subiendo}>
            Subir nueva versión
          </Button>
          <Button
            tamano="md"
            className="ml-auto"
            onClick={() => void descargar(vigente.id)}
            cargando={descargandoId === vigente.id}
          >
            Descargar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {(error || errorDescarga || errorSubida) && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error ?? errorDescarga ?? errorSubida}
          </p>
        )}

        <VistaPrevia url={urlVistaPrevia} mimeType={vigente.mimeType} titulo={titulo} />

        <section>
          <h3 className="text-[13px] font-semibold text-gray-700">Versiones</h3>
          {!versiones && !error && <div className="mt-2 h-9 animate-pulse rounded bg-gray-100" />}
          {versiones && (
            <ul className="mt-1">
              {versiones.map((version) => (
                <li key={version.id} className="flex items-center gap-3 border-t border-gray-100 py-2 text-[13px]">
                  <span className="w-6 font-semibold text-brand-700">v{version.version}</span>
                  <span className="min-w-0 flex-1 truncate text-gray-600 tabular-nums">{metaVersion(version)}</span>
                  {version.vigente && <Badge tono="success">Actual</Badge>}
                  <button
                    type="button"
                    onClick={() => void descargar(version.id)}
                    disabled={descargandoId === version.id}
                    className="text-[13px] font-medium text-brand-600 hover:text-brand-700 disabled:text-gray-400"
                  >
                    Descargar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Drawer>
  )
}
