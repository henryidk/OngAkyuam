import { useRef } from 'react'
import {
  ETIQUETAS_AREA_ATENCION,
  ETIQUETAS_TIPO_DOCUMENTO,
  type AreaAtencion,
  type TipoDocumento,
  type TipoRegistro,
} from '@akyuam/shared'
import type { UseDocumentosStaging } from '../hooks/useDocumentosStaging'

interface PasoDocumentosProps {
  tipoRegistro: TipoRegistro | ''
  areasReferidas: AreaAtencion[]
  staging: UseDocumentosStaging
}

interface DocumentoRequerido {
  tipo: TipoDocumento
  descripcion: string
}

const DOCUMENTO_ENTREVISTA: DocumentoRequerido = {
  tipo: 'ENTREVISTA_USUARIA',
  descripcion:
    'Documento físico llenado a mano y luego escaneado para respaldo. Requerido para toda usuaria, interna o externa.',
}

const DOCUMENTOS_ALBERGUE: DocumentoRequerido[] = [
  { tipo: 'CONVENIO_INGRESO', descripcion: 'Requisito de ingreso a albergue.' },
  { tipo: 'RECEPCION_BIENES', descripcion: 'Requisito de ingreso a albergue.' },
]

export default function PasoDocumentos({ tipoRegistro, areasReferidas, staging }: PasoDocumentosProps) {
  const documentosRequeridos =
    tipoRegistro === 'INTERNA' ? [DOCUMENTO_ENTREVISTA, ...DOCUMENTOS_ALBERGUE] : [DOCUMENTO_ENTREVISTA]

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Los archivos se suben automáticamente al guardar la usuaria en el último paso. Puedes continuar sin
        adjuntar nada ahora y agregarlos después desde la pantalla de confirmación.
      </p>
      {documentosRequeridos.map((documento) => (
        <SlotDocumento
          key={documento.tipo}
          documento={documento}
          areasReferidas={areasReferidas}
          staging={staging}
        />
      ))}
    </div>
  )
}

interface SlotDocumentoProps {
  documento: DocumentoRequerido
  areasReferidas: AreaAtencion[]
  staging: UseDocumentosStaging
}

function SlotDocumento({ documento, areasReferidas, staging }: SlotDocumentoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { documentosPorTipo, seleccionarArchivo, quitarArchivo, alternarAreaVisible } = staging
  const staged = documentosPorTipo[documento.tipo]

  function onCambiarArchivo(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0]
    if (archivo) {
      seleccionarArchivo(documento.tipo, archivo)
    }
    event.target.value = ''
  }

  return (
    <div className="rounded border border-gray-200 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800">{ETIQUETAS_TIPO_DOCUMENTO[documento.tipo]}</p>
          <p className="text-xs text-gray-500">{documento.descripcion}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={onCambiarArchivo}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
          >
            {staged ? 'Cambiar archivo' : 'Elegir archivo'}
          </button>
          {staged && (
            <button
              type="button"
              onClick={() => quitarArchivo(documento.tipo)}
              className="rounded border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
            >
              Quitar
            </button>
          )}
        </div>
      </div>

      {staged && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-600">
            {staged.archivo.name} · {(staged.archivo.size / 1024 / 1024).toFixed(2)} MB
          </p>
          {staged.error && <p className="mt-1 text-xs text-red-600">{staged.error}</p>}

          {!staged.error && (
            <div className="mt-2">
              <p className="text-xs font-medium text-gray-600">
                Visible para (privado por defecto):
              </p>
              {areasReferidas.length === 0 ? (
                <p className="mt-1 text-xs text-gray-400">
                  No hay áreas referidas todavía — este documento quedará visible solo para trabajo social.
                </p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-2">
                  {areasReferidas.map((area) => (
                    <label
                      key={area}
                      className="flex cursor-pointer items-center gap-1.5 rounded border border-gray-300 px-2 py-1 text-xs has-checked:border-brand-500 has-checked:bg-brand-50"
                    >
                      <input
                        type="checkbox"
                        className="accent-brand-600"
                        checked={staged.areasVisibles.includes(area)}
                        onChange={() => alternarAreaVisible(documento.tipo, area)}
                      />
                      {ETIQUETAS_AREA_ATENCION[area]}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
