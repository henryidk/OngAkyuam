import type { TipoRegistro } from '@akyuam/shared'

interface PasoDocumentosProps {
  tipoRegistro: TipoRegistro | ''
}

interface DocumentoRequerido {
  nombre: string
  descripcion: string
}

const DOCUMENTO_ENTREVISTA: DocumentoRequerido = {
  nombre: 'Entrevista a usuaria',
  descripcion:
    'Documento físico llenado a mano y luego escaneado para respaldo. Requerido para toda usuaria, interna o externa.',
}

const DOCUMENTOS_ALBERGUE: DocumentoRequerido[] = [
  { nombre: 'Convenio de ingreso', descripcion: 'Requisito de ingreso a albergue.' },
  { nombre: 'Documento de recepción de bienes', descripcion: 'Requisito de ingreso a albergue.' },
]

export default function PasoDocumentos({ tipoRegistro }: PasoDocumentosProps) {
  const documentos =
    tipoRegistro === 'INTERNA' ? [DOCUMENTO_ENTREVISTA, ...DOCUMENTOS_ALBERGUE] : [DOCUMENTO_ENTREVISTA]

  return (
    <div className="space-y-3">
      <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        La carga de archivos todavía no está disponible en el sistema — esta sección queda lista para cuando se
        habilite.
      </p>
      {documentos.map((documento) => (
        <div
          key={documento.nombre}
          className="flex flex-col gap-2 rounded border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-sm font-medium text-gray-800">{documento.nombre}</p>
            <p className="text-xs text-gray-500">{documento.descripcion}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled
              title="Disponible próximamente"
              className="cursor-not-allowed rounded border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-400"
            >
              Subir
            </button>
            <button
              type="button"
              disabled
              title="Disponible próximamente"
              className="cursor-not-allowed rounded border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-400"
            >
              Actualizar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
