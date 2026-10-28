import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, FileText } from 'lucide-react'
import {
  ETIQUETAS_CLINICA_PSICOLOGIA,
  fechaCalendarioGT,
  formatInstanteGT,
  nombreMesGT,
  type SesionProcesoDto,
} from '@akyuam/shared'
import EmptyState from '../../../components/ui/EmptyState'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { notasDe } from '../compartido/notasSesion'
import BotonVerDocumento from './BotonVerDocumento'
import { useContextoDetalle } from './contextoDetalle'
import PieSesiones from './PieSesiones'

const CLASE_TARJETA = 'rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]'

/** "Octubre 2026": encabezado de cada grupo, en hora de Guatemala. */
function mesDe(sesion: SesionProcesoDto): string {
  const [anio, mes] = fechaCalendarioGT(new Date(sesion.fechaHora)).split('-')
  return `${nombreMesGT(Number(mes))} ${anio}`
}

/** Sesiones ya ordenadas de la más reciente atrás, agrupadas por mes sin cambiar ese orden. */
function agruparPorMes(sesiones: SesionProcesoDto[]): { mes: string; sesiones: SesionProcesoDto[] }[] {
  const grupos: { mes: string; sesiones: SesionProcesoDto[] }[] = []
  for (const sesion of sesiones) {
    const mes = mesDe(sesion)
    const ultimo = grupos.at(-1)
    if (ultimo?.mes === mes) ultimo.sesiones.push(sesion)
    else grupos.push({ mes, sesiones: [sesion] })
  }
  return grupos
}

interface TarjetaSesionProps {
  sesion: SesionProcesoDto
  abierta: boolean
  onAlternar: () => void
}

/**
 * Cerrada muestra un adelanto de la primera nota (dos líneas) para reconocer la sesión sin
 * abrirla; abierta, todas las notas completas.
 */
function TarjetaSesion({ sesion, abierta, onAlternar }: TarjetaSesionProps) {
  const atendida = sesion.estado === 'ATENDIDA'
  const notas = notasDe(sesion)
  const idNotas = `notas-${sesion.citaId}`
  const [adelanto] = notas

  return (
    <li className={`${CLASE_TARJETA} ${atendida ? '' : 'bg-gray-50/70'}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3 pb-2">
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
            {sesion.clinica !== null && <> · {ETIQUETAS_CLINICA_PSICOLOGIA[sesion.clinica]}</>}
            {sesion.persona.ninoId !== null && <> · {sesion.persona.nombreCompleto}</>}
          </p>
        </div>
        {sesion.documento && (
          <span className="flex flex-none items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600">
            <FileText aria-hidden="true" className="h-3.5 w-3.5 text-gray-400" />
            Hoja de evolución
            <BotonVerDocumento citaId={sesion.citaId} nombreArchivo={sesion.documento.nombreArchivo} />
          </span>
        )}
      </div>

      {notas.length === 0 ? (
        <p className="px-4 pb-3 text-xs text-gray-400 italic">{atendida ? 'Sin notas registradas.' : 'Sin motivo registrado.'}</p>
      ) : abierta ? (
        <dl id={idNotas} className="space-y-3 border-t border-gray-100 px-4 py-3">
          {notas.map((nota) => (
            <div key={nota.titulo}>
              <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">{nota.titulo}</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">{nota.texto}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="line-clamp-2 px-4 text-sm text-gray-700">
          <span className="font-medium text-gray-500">{adelanto.titulo}: </span>
          {adelanto.texto}
        </p>
      )}

      {notas.length > 0 && (
        <div className="px-4 pt-1 pb-3">
          <button
            type="button"
            aria-expanded={abierta}
            aria-controls={abierta ? idNotas : undefined}
            onClick={onAlternar}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            {abierta ? 'Ocultar' : atendida ? 'Ver sesión completa' : 'Ver motivo completo'}
          </button>
        </div>
      )}
    </li>
  )
}

/**
 * Sesiones e inasistencias del proceso, de la más reciente a la más antigua, agrupadas por mes.
 * Llegan por páginas, y cada tarjeta muestra solo un adelanto hasta que se abre.
 */
export default function PestanaSesiones() {
  const { proceso, sesiones } = useContextoDetalle()
  const [params] = useSearchParams()
  // Desde la agenda se llega con "?sesion=": esa sesión aparece ya desplegada.
  const [abiertas, setAbiertas] = useState<ReadonlySet<string>>(() => {
    const pedida = params.get('sesion')
    return new Set(pedida ? [pedida] : [])
  })

  if (sesiones.error && !sesiones.items) {
    return <ErrorVista mensaje={sesiones.error} recurso="las sesiones" onReintentar={sesiones.recargar} />
  }
  if (!sesiones.items) return <Esqueleto />
  if (sesiones.items.length === 0) {
    return (
      <EmptyState
        Icono={CalendarClock}
        titulo="Todavía no hay sesiones registradas"
        descripcion={
          proceso.citasSinRegistrar.length > 0
            ? 'Registra la cita pendiente para que aparezca aquí.'
            : 'Aparecerán aquí al registrar la primera sesión desde la agenda.'
        }
      />
    )
  }

  const conNotas = sesiones.items.filter((sesion) => notasDe(sesion).length > 0)
  const todasAbiertas = conNotas.length > 0 && conNotas.every((sesion) => abiertas.has(sesion.citaId))

  function alternar(citaId: string) {
    setAbiertas((previas) => {
      const siguientes = new Set(previas)
      if (siguientes.has(citaId)) siguientes.delete(citaId)
      else siguientes.add(citaId)
      return siguientes
    })
  }

  return (
    <>
      {conNotas.length > 1 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setAbiertas(todasAbiertas ? new Set() : new Set(conNotas.map((sesion) => sesion.citaId)))}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline"
          >
            {todasAbiertas ? 'Contraer todas' : 'Expandir todas'}
          </button>
        </div>
      )}
      {agruparPorMes(sesiones.items).map((grupo) => (
        <section key={grupo.mes} aria-label={grupo.mes} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {grupo.mes} <span className="font-normal normal-case tracking-normal">· {grupo.sesiones.length}</span>
          </h3>
          <ul className="space-y-3">
            {grupo.sesiones.map((sesion) => (
              <TarjetaSesion
                key={sesion.citaId}
                sesion={sesion}
                abierta={abiertas.has(sesion.citaId)}
                onAlternar={() => alternar(sesion.citaId)}
              />
            ))}
          </ul>
        </section>
      ))}
      <PieSesiones sesiones={sesiones} />
    </>
  )
}
