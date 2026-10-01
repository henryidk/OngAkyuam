import { useRef } from 'react'
import {
  documentosRequeridos,
  ETIQUETAS_TIPO_DOCUMENTO,
  TIPOS_DOCUMENTO_ALBERGUE,
  type TipoDocumentoTrabajoSocial,
  type TipoRegistro,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import type { UseDocumentosStaging } from '../hooks/useDocumentosStaging'

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
        Puedes registrar sin adjuntar nada: lo que falte aparecerá en “Documentos por subir” en tu bandeja. Quién
        puede ver cada documento se define al referir.
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
  const { documentosPorTipo, seleccionarArchivo, quitarArchivo } = staging
  const staged = documentosPorTipo[tipo]
  const esDeAlbergue = (TIPOS_DOCUMENTO_ALBERGUE as readonly string[]).includes(tipo)

  function onCambiarArchivo(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0]
    if (archivo) {
      seleccionarArchivo(tipo, archivo)
    }
    event.target.value = ''
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800">
          {ETIQUETAS_TIPO_DOCUMENTO[tipo]}
          <span className="text-xs font-normal text-gray-500">
            {' '}
            · {esDeAlbergue ? 'requerido para albergue' : 'obligatorio'}
          </span>
        </p>
        {staged ? (
          <p className={`mt-0.5 truncate text-xs ${staged.error ? 'text-red-600' : 'text-green-700'}`}>
            {staged.error ?? `${staged.archivo.name} · ${(staged.archivo.size / 1024 / 1024).toFixed(2)} MB`}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-gray-500">Pendiente</p>
        )}
      </div>
      <input ref={inputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={onCambiarArchivo} />
      {staged && (
        <button
          type="button"
          onClick={() => quitarArchivo(tipo)}
          className="text-xs font-medium text-gray-500 hover:underline"
        >
          Quitar
        </button>
      )}
      <Button type="button" variante="acento" onClick={() => inputRef.current?.click()}>
        {staged ? 'Cambiar' : 'Elegir archivo'}
      </Button>
    </div>
  )
}
