import { CircleAlert, CircleCheck, FileUp, Loader2, RotateCw } from 'lucide-react'
import { useRef } from 'react'
import {
  documentosRequeridos,
  ETIQUETAS_TIPO_DOCUMENTO,
  TIPOS_DOCUMENTO_ALBERGUE,
  type TipoDocumentoTrabajoSocial,
  type TipoRegistro,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import type { DocumentoRegistro, UseDocumentosStaging } from '../hooks/useDocumentosStaging'

interface PasoDocumentosProps {
  tipoRegistro: TipoRegistro | ''
  staging: UseDocumentosStaging
}

export default function PasoDocumentos({ tipoRegistro, staging }: PasoDocumentosProps) {
  // Al registrar todavía no hay egreso; los requeridos al registrar son siempre formularios de
  // Trabajo Social, por eso el cast al subconjunto que acepta el endpoint de subida.
  const requeridos = documentosRequeridos(tipoRegistro || 'EXTERNA', false) as TipoDocumentoTrabajoSocial[]

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-lg bg-gray-50 px-3.5 py-2.5 text-[13px] text-gray-500">
        Cada archivo se sube en cuanto lo eliges. Puedes registrar sin adjuntar nada: lo que falte aparecerá en
        “Documentos por subir” en tu bandeja. Quién puede ver cada documento se define al referir.
      </p>
      {requeridos.map((tipo) => (
        <SlotDocumento key={tipo} tipo={tipo} staging={staging} />
      ))}
    </div>
  )
}

interface SlotDocumentoProps {
  tipo: TipoDocumentoTrabajoSocial
  staging: UseDocumentosStaging
}

function SlotDocumento({ tipo, staging }: SlotDocumentoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { documentosPorTipo, seleccionarArchivo, quitarArchivo, reintentar } = staging
  const documento = documentosPorTipo[tipo]
  const esDeAlbergue = (TIPOS_DOCUMENTO_ALBERGUE as readonly string[]).includes(tipo)
  const etiqueta = ETIQUETAS_TIPO_DOCUMENTO[tipo]

  function onCambiarArchivo(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0]
    if (archivo) {
      seleccionarArchivo(tipo, archivo)
    }
    event.target.value = ''
  }

  const bordeSegunEstado =
    documento?.estado === 'error'
      ? 'border-red-200 bg-red-50/40'
      : documento?.estado === 'subido'
        ? 'border-green-200 bg-green-50/40'
        : 'border-gray-200'

  return (
    <div className={`overflow-hidden rounded-lg border transition-colors ${bordeSegunEstado}`}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <IconoEstado documento={documento} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-800">
            {etiqueta}
            <span className="text-xs font-normal text-gray-500">
              {' '}
              · {esDeAlbergue ? 'requerido para albergue' : 'obligatorio'}
            </span>
          </p>
          <DetalleEstado documento={documento} />
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/*"
          className="hidden"
          aria-label={`Archivo para ${etiqueta}`}
          onChange={onCambiarArchivo}
        />
        {documento?.estado === 'error' && documento.reintentable && (
          <Button type="button" variante="acento" onClick={() => reintentar(tipo)}>
            <RotateCw size={12} aria-hidden="true" className="mr-1 inline" />
            Reintentar
          </Button>
        )}
        {documento && (
          <button
            type="button"
            onClick={() => quitarArchivo(tipo)}
            className="text-xs font-medium text-gray-500 hover:underline"
          >
            {documento.estado === 'subiendo' ? 'Cancelar' : 'Quitar'}
          </button>
        )}
        {documento?.estado !== 'subiendo' && (
          <Button type="button" variante="acento" onClick={() => inputRef.current?.click()}>
            {documento ? 'Cambiar' : 'Elegir archivo'}
          </Button>
        )}
      </div>
      {documento?.estado === 'subiendo' && (
        <div
          role="progressbar"
          aria-label={`Subiendo ${etiqueta}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={documento.progreso}
          className="h-1 bg-brand-50"
        >
          <div
            className="h-full bg-brand-600 transition-[width] duration-200 ease-out"
            style={{ width: `${Math.max(documento.progreso, 3)}%` }}
          />
        </div>
      )}
    </div>
  )
}

function IconoEstado({ documento }: { documento: DocumentoRegistro | undefined }) {
  if (!documento) {
    return <FileUp size={18} className="shrink-0 text-gray-400" aria-hidden="true" />
  }
  if (documento.estado === 'subiendo') {
    return <Loader2 size={18} className="shrink-0 animate-spin text-brand-600" aria-hidden="true" />
  }
  if (documento.estado === 'subido') {
    return <CircleCheck size={18} className="shrink-0 text-green-600" aria-hidden="true" />
  }
  return <CircleAlert size={18} className="shrink-0 text-red-600" aria-hidden="true" />
}

function DetalleEstado({ documento }: { documento: DocumentoRegistro | undefined }) {
  if (!documento) {
    return <p className="mt-0.5 text-xs text-gray-500">Pendiente</p>
  }
  const nombreYTamano = `${documento.archivo.name} · ${formatearTamano(documento.archivo.size)}`
  if (documento.estado === 'subiendo') {
    return (
      <p className="mt-0.5 truncate text-xs text-gray-600" aria-live="polite">
        Subiendo… {documento.progreso}% · {documento.archivo.name}
      </p>
    )
  }
  if (documento.estado === 'subido') {
    return (
      <p className="mt-0.5 truncate text-xs text-green-700" aria-live="polite">
        Subido · {nombreYTamano}
      </p>
    )
  }
  return (
    <p className="mt-0.5 text-xs text-red-600" role="alert">
      No se subió: {documento.mensajeError}
      {!documento.reintentable && ' Elige otro archivo.'}
    </p>
  )
}

function formatearTamano(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
