import { CircleAlert, CircleCheck, FileUp, Loader2, RotateCw } from 'lucide-react'
import { useRef } from 'react'
import {
  documentosRequeridos,
  ETIQUETAS_AREA_ATENCION,
  ETIQUETAS_TIPO_DOCUMENTO,
  TIPOS_DOCUMENTO_ALBERGUE,
  type AreaAtencion,
  type TipoDocumentoTrabajoSocial,
  type TipoRegistro,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import Switch from '../../../components/ui/Switch'
import { ACCEPT_DOCUMENTOS, formatearTamanio } from '../../../lib/documentos/archivoDocumento'
import type { DocumentoNuevoCaso, UseDocumentosNuevoCaso } from '../hooks/useDocumentosNuevoCaso'

interface PasoDocumentosProps {
  tipoRegistro: TipoRegistro
  documentos: UseDocumentosNuevoCaso
  /** Las referidas en el paso anterior: solo a ellas se les puede compartir un documento. */
  areasReferidas: AreaAtencion[]
}

export default function PasoDocumentos({ tipoRegistro, documentos, areasReferidas }: PasoDocumentosProps) {
  // Al registrar todavía no hay egreso; los requeridos al registrar son siempre formularios de
  // Trabajo Social, por eso el cast al subconjunto que acepta el endpoint de subida.
  const requeridos = documentosRequeridos(tipoRegistro, false) as TipoDocumentoTrabajoSocial[]
  // Jurídico ve los formularios de Trabajo Social por normativa: no hay nada que elegir.
  const restringibles = areasReferidas.filter((area) => area !== 'JURIDICO')

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-lg bg-gray-50 px-3.5 py-2.5 text-[13px] text-gray-500">
        Cada archivo se sube al expediente en cuanto lo eliges. Puedes terminar sin adjuntar nada: lo que falte
        aparecerá en “Documentos por subir” en tu bandeja.{' '}
        {areasReferidas.includes('JURIDICO') && 'El área jurídica los verá por normativa. '}
        {restringibles.length > 0
          ? 'Para las demás áreas, cada documento es privado salvo que lo compartas.'
          : 'Los documentos quedan privados para Trabajo Social.'}
      </p>
      {requeridos.map((tipo) => (
        <SlotDocumento key={tipo} tipo={tipo} documentos={documentos} restringibles={restringibles} />
      ))}
      {documentos.errorVisibilidad && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudo cambiar con quién se comparte: {documentos.errorVisibilidad}
        </p>
      )}
    </div>
  )
}

interface SlotDocumentoProps {
  tipo: TipoDocumentoTrabajoSocial
  documentos: UseDocumentosNuevoCaso
  restringibles: AreaAtencion[]
}

function SlotDocumento({ tipo, documentos, restringibles }: SlotDocumentoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const documento = documentos.documentos[tipo]
  const visiblePara = documentos.visibilidad[tipo] ?? []
  const esDeAlbergue = (TIPOS_DOCUMENTO_ALBERGUE as readonly string[]).includes(tipo)
  const etiqueta = ETIQUETAS_TIPO_DOCUMENTO[tipo]
  const subiendo = documento?.estado === 'subiendo'

  function onCambiarArchivo(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0]
    if (archivo) {
      documentos.seleccionarArchivo(tipo, archivo)
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
          accept={ACCEPT_DOCUMENTOS}
          className="hidden"
          aria-label={`Archivo para ${etiqueta}`}
          onChange={onCambiarArchivo}
        />
        {documento?.estado === 'error' && documento.reintentable && (
          <Button type="button" variante="acento" onClick={() => documentos.reintentar(tipo)}>
            <RotateCw size={12} aria-hidden="true" className="mr-1 inline" />
            Reintentar
          </Button>
        )}
        {!subiendo && (
          <Button type="button" variante="acento" onClick={() => inputRef.current?.click()}>
            {documento?.documentoId ? 'Reemplazar' : documento ? 'Elegir otro' : 'Elegir archivo'}
          </Button>
        )}
      </div>

      {subiendo && (
        <div
          role="progressbar"
          aria-label={`Subiendo ${etiqueta}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={documento.progreso ?? undefined}
          className="h-1 bg-brand-50"
        >
          <div
            className={`h-full bg-brand-600 transition-[width] duration-200 ease-out ${documento.progreso === null ? 'animate-pulse' : ''}`}
            style={{ width: `${documento.progreso === null ? 100 : Math.max(documento.progreso, 3)}%` }}
          />
        </div>
      )}

      {restringibles.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-gray-100 px-4 py-2.5">
          <span className="text-xs text-gray-500">Compartir con</span>
          {restringibles.map((area) => {
            const nombreArea = ETIQUETAS_AREA_ATENCION[area]
            return (
              <span key={area} className="flex items-center gap-2 text-xs font-medium text-gray-700">
                <Switch
                  encendido={visiblePara.includes(area)}
                  onChange={(visible) => void documentos.alternarVisibilidad(tipo, area, visible)}
                  ariaLabel={`Compartir ${etiqueta} con el área ${nombreArea}`}
                  // Mientras sube, el archivo ya salió con la visibilidad anterior.
                  deshabilitado={subiendo}
                />
                {nombreArea}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function IconoEstado({ documento }: { documento: DocumentoNuevoCaso | undefined }) {
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

function DetalleEstado({ documento }: { documento: DocumentoNuevoCaso | undefined }) {
  if (!documento) {
    return <p className="mt-0.5 text-xs text-gray-500">Pendiente</p>
  }
  if (documento.estado === 'subiendo') {
    return (
      <p className="mt-0.5 truncate text-xs text-gray-600" aria-live="polite">
        Subiendo…{documento.progreso !== null && ` ${documento.progreso}%`} · {documento.archivo.name}
      </p>
    )
  }
  if (documento.estado === 'subido') {
    return (
      <p className="mt-0.5 truncate text-xs text-green-700" aria-live="polite">
        Guardado en el expediente · {documento.archivo.name} · {formatearTamanio(documento.archivo.size)}
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
