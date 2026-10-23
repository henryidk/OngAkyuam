import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ETIQUETAS_ORIGEN_CANCELACION,
  type AccionAudiencia,
  type AudienciaDetalleDto,
  type DocumentoProcesoDto,
} from '@akyuam/shared'
import DocumentosAdjuntos from '../documentos/DocumentosAdjuntos'
import { RUTAS_JURIDICO } from '../rutas'
import EtiquetaEstadoAudiencia from './EtiquetaEstadoAudiencia'
import BarraAccionesAudiencia from './BarraAccionesAudiencia'
import { textoEnlazada } from './formato'

const CLASE_ENLACE = 'font-medium text-brand-700 hover:underline'

interface TarjetaAudienciaProps {
  audiencia: AudienciaDetalleDto
  /** Se llegó desde el chip de un documento: se enfoca y se marca. */
  resaltada: boolean
  onAccion: (accion: AccionAudiencia, audiencia: AudienciaDetalleDto) => void
  onVerDocumento: (documento: DocumentoProcesoDto) => void
  onDescargarDocumento: (documento: DocumentoProcesoDto) => void
}

/** Un punto de la línea de tiempo: estado, reprogramaciones enlazadas, observaciones y documentos. */
export default function TarjetaAudiencia({
  audiencia,
  resaltada,
  onAccion,
  onVerDocumento,
  onDescargarDocumento,
}: TarjetaAudienciaProps) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    // `nearest`: si ya está a la vista no mueve nada (con `center` se desplazaba todo el layout).
    if (resaltada) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [resaltada])

  const origen =
    audiencia.origenCancelacion && audiencia.origenCancelacion !== 'MANUAL'
      ? ETIQUETAS_ORIGEN_CANCELACION[audiencia.origenCancelacion]
      : null
  const enlace = (id: string) => RUTAS_JURIDICO.audienciasProceso(audiencia.procesoId, { audienciaId: id })

  return (
    <li ref={ref} className="relative pb-5 pl-7 last:pb-0">
      <span aria-hidden="true" className="absolute top-2 bottom-0 left-[7px] w-px bg-gray-200" />
      <span
        aria-hidden="true"
        className={`absolute top-1.5 left-0.5 h-3 w-3 rounded-full border-2 border-white ring-1 ${
          resaltada ? 'bg-brand-600 ring-brand-600' : 'bg-gray-300 ring-gray-300'
        }`}
      />
      <article
        className={`rounded-xl border bg-white p-4 ${resaltada ? 'border-brand-600 ring-1 ring-brand-600' : 'border-gray-200'}`}
      >
        <header className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">
                <span className="tabular-nums">{textoEnlazada(audiencia)}</span>
              </h3>
              <EtiquetaEstadoAudiencia estado={audiencia.estadoVisible} />
            </div>
            <p className="text-[13px] text-gray-600">
              {audiencia.descripcion && <>{audiencia.descripcion} · </>}
              {audiencia.responsable.nombre}
            </p>
          </div>
        </header>

        <div className="mt-2 space-y-1.5 text-[13px] text-gray-700">
          {origen && <p className="text-gray-500">{origen}</p>}
          {audiencia.reprogramadaA && (
            <p>
              Reprogramada →{' '}
              <Link to={enlace(audiencia.reprogramadaA.id)} className={`${CLASE_ENLACE} tabular-nums`}>
                {textoEnlazada(audiencia.reprogramadaA)}
              </Link>
            </p>
          )}
          {audiencia.reprogramadaDesde && (
            <p>
              Nueva fecha de la audiencia del{' '}
              <Link to={enlace(audiencia.reprogramadaDesde.id)} className={`${CLASE_ENLACE} tabular-nums`}>
                {textoEnlazada(audiencia.reprogramadaDesde)}
              </Link>
            </p>
          )}
          {audiencia.motivo && (
            <p>
              <span className="font-medium text-gray-900">Motivo:</span> {audiencia.motivo}
            </p>
          )}
          {audiencia.observaciones && (
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Observaciones</p>
              <p className="mt-0.5 whitespace-pre-wrap text-gray-800">{audiencia.observaciones}</p>
            </div>
          )}
        </div>

        {audiencia.documentos.length > 0 && (
          <div className="mt-3">
            <DocumentosAdjuntos documentos={audiencia.documentos} onVer={onVerDocumento} onDescargar={onDescargarDocumento} />
          </div>
        )}

        <BarraAccionesAudiencia audiencia={audiencia} onAccion={onAccion} />
      </article>
    </li>
  )
}
