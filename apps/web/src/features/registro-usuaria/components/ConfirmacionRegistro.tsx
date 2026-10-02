import { Check, CircleAlert, CircleCheck, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  ETIQUETAS_TIPO_DOCUMENTO,
  type ExpedienteCreado,
  type TipoDocumentoTrabajoSocial,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import type { DocumentoEnSubida } from '../hooks/useDocumentosStaging'

interface ConfirmacionRegistroProps {
  expediente: ExpedienteCreado
  usuariaExistente: boolean
  cantidadHijos: number
  documentosEnSubida: DocumentoEnSubida[]
  onReintentarDocumento: (tipo: TipoDocumentoTrabajoSocial) => void
  onNuevoRegistro: () => void
}

export default function ConfirmacionRegistro({
  expediente,
  usuariaExistente,
  cantidadHijos,
  documentosEnSubida,
  onReintentarDocumento,
  onNuevoRegistro,
}: ConfirmacionRegistroProps) {
  const navigate = useNavigate()
  const rutaFicha = `/trabajo-social/usuarias/${expediente.usuariaId}`

  // Un caso nuevo siempre es el activo: la ficha lo muestra por defecto.
  function irALaFicha() {
    navigate(rutaFicha)
  }

  // Referir no es parte del wizard: la ficha abre su modal sobre el caso recién creado.
  function referirAhora() {
    navigate(rutaFicha, { state: { abrirReferir: true } })
  }

  return (
    <div className="mx-auto mt-6 max-w-[560px] rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
        <Check size={22} strokeWidth={2.5} />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-gray-900">
        {usuariaExistente ? 'Caso registrado' : 'Usuaria registrada'}
      </h2>
      <p className="mt-2 text-sm text-gray-700">
        {expediente.usuariaNombreCompleto} · Expediente <span className="font-semibold">{expediente.numero}</span>
        {cantidadHijos > 0 && ` · ${cantidadHijos} ${cantidadHijos === 1 ? 'hija/hijo' : 'hijas/hijos'}`}
      </p>
      <p className="mt-2 text-[13px] text-gray-500">
        Siguiente paso: referirla a las áreas que la atenderán. También puedes hacerlo después desde su ficha.
      </p>

      {documentosEnSubida.length > 0 && (
        <div className="mt-6 space-y-2 text-left">
          <p className="text-xs font-medium text-gray-700" aria-live="polite">
            {resumenSubida(documentosEnSubida)}
          </p>
          {documentosEnSubida.map((documento) => (
            <div key={documento.tipo} className="overflow-hidden rounded-lg border border-gray-200 text-xs">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-800">{ETIQUETAS_TIPO_DOCUMENTO[documento.tipo]}</p>
                  <p className="mt-0.5 truncate text-gray-500">{documento.archivo.name}</p>
                  {documento.estado === 'error' && (
                    <p className="mt-0.5 text-red-600">{documento.mensajeError ?? 'Error al subir el archivo.'}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <EstadoDocumento estado={documento.estado} />
                  {documento.estado === 'error' && (
                    <Button type="button" variante="acento" onClick={() => onReintentarDocumento(documento.tipo)}>
                      Reintentar
                    </Button>
                  )}
                </div>
              </div>
              {documento.estado === 'subiendo' && (
                <div className="h-1 bg-brand-50">
                  <div className="h-full w-full animate-pulse bg-brand-600" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button type="button" variante="secondary" tamano="md" onClick={irALaFicha}>
          Ir a la ficha
        </Button>
        <Button type="button" tamano="md" onClick={referirAhora}>
          Referir ahora
        </Button>
      </div>
      <button type="button" onClick={onNuevoRegistro} className="mt-4 text-xs font-medium text-brand-600 hover:underline">
        Registrar otra usuaria
      </button>

    </div>
  )
}

function resumenSubida(documentos: DocumentoEnSubida[]): string {
  const subiendo = documentos.filter((documento) => documento.estado === 'subiendo').length
  if (subiendo > 0) {
    return `Subiendo documentos… no cierres esta página (${documentos.length - subiendo} de ${documentos.length} listos)`
  }
  const conError = documentos.filter((documento) => documento.estado === 'error').length
  if (conError > 0) {
    return conError === 1 ? 'Un documento no se pudo subir' : `${conError} documentos no se pudieron subir`
  }
  return documentos.length === 1 ? 'Documento subido' : 'Documentos subidos'
}

function EstadoDocumento({ estado }: { estado: DocumentoEnSubida['estado'] }) {
  if (estado === 'subiendo') {
    return (
      <span role="status" className="inline-flex items-center gap-1 text-gray-500">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        Subiendo…
      </span>
    )
  }
  if (estado === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-green-700">
        <CircleCheck size={14} aria-hidden="true" />
        Subido
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 font-medium text-red-700">
      <CircleAlert size={14} aria-hidden="true" />
      Error
    </span>
  )
}
