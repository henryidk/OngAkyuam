import { ETIQUETAS_TIPO_DOCUMENTO, formatFechaGT, type ExpedienteCreado, type TipoDocumento } from '@akyuam/shared'
import type { DocumentoEnSubida } from '../lib/documentosUpload'

interface ConfirmacionRegistroProps {
  expediente: ExpedienteCreado
  usuariaExistente: boolean
  documentosEnSubida: DocumentoEnSubida[]
  onReintentarDocumento: (tipo: TipoDocumento) => void
  onNuevoRegistro: () => void
}

export default function ConfirmacionRegistro({
  expediente,
  usuariaExistente,
  documentosEnSubida,
  onReintentarDocumento,
  onNuevoRegistro,
}: ConfirmacionRegistroProps) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-brand-200 bg-brand-50 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-semibold text-brand-900">
        {usuariaExistente ? 'Caso guardado correctamente' : 'Usuaria guardada correctamente'}
      </h2>
      <p className="mt-2 text-sm text-brand-800">
        Expediente <span className="font-semibold">{expediente.numero}</span> — {expediente.usuariaNombreCompleto}
      </p>
      <p className="text-xs text-brand-700">Fecha del registro: {formatFechaGT(expediente.fecha)}</p>

      {documentosEnSubida.length > 0 && (
        <div className="mt-6 space-y-2 text-left">
          <p className="text-xs font-medium text-brand-900">Documentos</p>
          {documentosEnSubida.map((documento) => (
            <div
              key={documento.tipo}
              className="flex items-center justify-between rounded border border-brand-200 bg-white px-3 py-2 text-xs"
            >
              <div>
                <p className="font-medium text-gray-800">{ETIQUETAS_TIPO_DOCUMENTO[documento.tipo]}</p>
                {documento.estado === 'error' && (
                  <p className="mt-0.5 text-red-600">{documento.mensajeError ?? 'Error al subir el archivo.'}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <EstadoDocumento estado={documento.estado} />
                {documento.estado === 'error' && (
                  <button
                    type="button"
                    onClick={() => onReintentarDocumento(documento.tipo)}
                    className="rounded border border-brand-300 px-2 py-1 font-medium text-brand-700 hover:bg-brand-50"
                  >
                    Reintentar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onNuevoRegistro}
        className="mt-6 rounded bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        {usuariaExistente ? 'Volver a buscar' : 'Registrar otra usuaria'}
      </button>
    </div>
  )
}

function EstadoDocumento({ estado }: { estado: DocumentoEnSubida['estado'] }) {
  if (estado === 'subiendo') {
    return <span className="text-gray-500">Subiendo…</span>
  }
  if (estado === 'ok') {
    return <span className="font-medium text-green-700">Subido</span>
  }
  return <span className="font-medium text-red-700">Error</span>
}
