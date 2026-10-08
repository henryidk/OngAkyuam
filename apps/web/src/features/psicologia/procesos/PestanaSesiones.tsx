import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, FileText } from 'lucide-react'
import { formatInstanteGT, type SesionProcesoDto } from '@akyuam/shared'
import EmptyState from '../../../components/ui/EmptyState'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { formatearTamanio } from '../../../lib/documentos/archivoDocumento'
import BotonVerDocumento from './BotonVerDocumento'
import { useContextoDetalle } from './contextoDetalle'
import PieSesiones from './PieSesiones'

const CLASE_TARJETA = 'rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]'

function Nota({ titulo, texto }: { titulo: string; texto: string | null }) {
  if (!texto) return null
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">{titulo}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">{texto}</dd>
    </div>
  )
}

function TarjetaSesion({ sesion, abiertaAlEntrar }: { sesion: SesionProcesoDto; abiertaAlEntrar: boolean }) {
  const [abierta, setAbierta] = useState(abiertaAlEntrar)
  const atendida = sesion.estado === 'ATENDIDA'
  const idNotas = `notas-${sesion.citaId}`
  const hayNotas = atendida
    ? [sesion.temas, sesion.intervencion, sesion.recomendaciones, sesion.acuerdos, sesion.observaciones].some(Boolean)
    : Boolean(sesion.motivoNoAsistencia)

  return (
    <li className={`${CLASE_TARJETA} ${atendida ? '' : 'bg-gray-50/70'}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1 basis-56">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {atendida ? `Sesión ${sesion.numero ?? ''}`.trim() : 'No asistió'}
            </span>
            {!atendida && (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Inasistencia</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500 tabular-nums">
            {formatInstanteGT(sesion.fechaHora)} · {sesion.duracionMinutos} min
            {sesion.persona.ninoId !== null && <> · {sesion.persona.nombreCompleto}</>}
          </p>
        </div>
        {hayNotas && (
          <button
            type="button"
            aria-expanded={abierta}
            aria-controls={idNotas}
            onClick={() => setAbierta((valor) => !valor)}
            className="flex-none text-sm font-medium text-brand-700 hover:underline"
          >
            {abierta ? 'Ocultar' : atendida ? 'Ver notas' : 'Ver motivo'}
          </button>
        )}
      </div>

      {hayNotas && abierta && (
        <dl id={idNotas} className="space-y-3 border-t border-gray-100 px-4 py-3">
          {atendida ? (
            <>
              <Nota titulo="Temas abordados" texto={sesion.temas} />
              <Nota titulo="Intervención" texto={sesion.intervencion} />
              <Nota titulo="Recomendaciones" texto={sesion.recomendaciones} />
              <Nota titulo="Acuerdos" texto={sesion.acuerdos} />
              <Nota titulo="Observaciones" texto={sesion.observaciones} />
            </>
          ) : (
            <Nota titulo="Motivo" texto={sesion.motivoNoAsistencia} />
          )}
        </dl>
      )}

      {sesion.documento && (
        <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-2.5">
          <FileText aria-hidden="true" className="h-4 w-4 flex-none text-gray-400" />
          <p className="min-w-0 flex-1 truncate text-sm text-gray-700">
            {sesion.documento.nombreArchivo}{' '}
            <span className="text-xs text-gray-500">· {formatearTamanio(sesion.documento.tamanioBytes)}</span>
          </p>
          <BotonVerDocumento citaId={sesion.citaId} nombreArchivo={sesion.documento.nombreArchivo} />
        </div>
      )}
    </li>
  )
}

/** Sesiones e inasistencias del proceso, de la más reciente a la más antigua. Las notas se abren a pedido. */
export default function PestanaSesiones() {
  const { sesiones } = useContextoDetalle()
  const [params] = useSearchParams()
  // Desde la agenda se llega con "?sesion=": esa sesión aparece ya desplegada.
  const sesionPedida = params.get('sesion')

  if (sesiones.error && !sesiones.items) {
    return <ErrorVista mensaje={sesiones.error} recurso="las sesiones" onReintentar={sesiones.recargar} />
  }
  if (!sesiones.items) return <Esqueleto />
  if (sesiones.items.length === 0) {
    return (
      <EmptyState
        Icono={CalendarClock}
        titulo="Todavía no hay sesiones registradas"
        descripcion="Aparecerán aquí al registrar la primera sesión desde la agenda."
      />
    )
  }

  return (
    <>
      <ul className="space-y-3">
        {sesiones.items.map((sesion) => (
          <TarjetaSesion key={sesion.citaId} sesion={sesion} abiertaAlEntrar={sesion.citaId === sesionPedida} />
        ))}
      </ul>
      <PieSesiones sesiones={sesiones} />
    </>
  )
}
