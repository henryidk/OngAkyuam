import { Link, useNavigate } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import {
  ETIQUETAS_ORIGEN_CANCELACION,
  diasDesdeFechaGT,
  formatFechaGT,
  type AccionAudiencia,
  type AudienciaFilaDto,
  type VistaAudiencias,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { formatHora12 } from '../compartido/hora12'
import { RUTAS_JURIDICO } from '../rutas'
import EtiquetaEstadoAudiencia from './EtiquetaEstadoAudiencia'
import { ETIQUETAS_ACCION_AUDIENCIA, separarAcciones, textoEspera } from './formato'
import { ICONOS_ACCION_AUDIENCIA } from './iconosAccion'
import MenuAcciones from '../../../components/ui/MenuAcciones'

/** Desde una semana sin resultado, la espera se marca en rojo. */
export const DIAS_ESPERA_ATRASADA = 7

interface FilaAudienciaProps {
  audiencia: AudienciaFilaDto
  vista: VistaAudiencias
  onAccion: (accion: AccionAudiencia, audiencia: AudienciaFilaDto) => void
}

const CELDA = 'px-4 py-3.5'

function CeldaCuando({ audiencia, vista }: { audiencia: AudienciaFilaDto; vista: VistaAudiencias }) {
  const hora = formatHora12(audiencia.hora)
  if (vista === 'proximas') {
    return <td className={`${CELDA} whitespace-nowrap text-sm font-semibold text-gray-900 tabular-nums`}>{hora}</td>
  }
  const espera = diasDesdeFechaGT(audiencia.fecha)
  return (
    <td className={`${CELDA} whitespace-nowrap`}>
      <p className="text-sm text-gray-900 tabular-nums">{formatFechaGT(audiencia.fecha)}</p>
      <p className="text-xs text-gray-500 tabular-nums">{hora}</p>
      {vista === 'pendientes' && (
        <p
          className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${
            espera >= DIAS_ESPERA_ATRASADA ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
          }`}
        >
          {textoEspera(espera)}
        </p>
      )}
    </td>
  )
}

export default function FilaAudiencia({ audiencia, vista, onAccion }: FilaAudienciaProps) {
  const navigate = useNavigate()
  const { principal, secundarias } = separarAcciones(audiencia.accionesDisponibles)
  const IconoPrincipal = principal ? ICONOS_ACCION_AUDIENCIA[principal] : null
  const origen =
    audiencia.origenCancelacion && audiencia.origenCancelacion !== 'MANUAL'
      ? ETIQUETAS_ORIGEN_CANCELACION[audiencia.origenCancelacion]
      : null
  const opciones = [
    ...secundarias.map((accion) => ({
      clave: accion,
      etiqueta: ETIQUETAS_ACCION_AUDIENCIA[accion],
      Icono: ICONOS_ACCION_AUDIENCIA[accion],
      onElegir: () => onAccion(accion, audiencia),
    })),
    { clave: 'VER_PROCESO', etiqueta: 'Ver proceso', Icono: FolderOpen, onElegir: () => navigate(RUTAS_JURIDICO.proceso(audiencia.procesoId)) },
  ]

  return (
    <tr className="border-t border-gray-100 align-top transition-colors hover:bg-gray-50/60">
      <CeldaCuando audiencia={audiencia} vista={vista} />
      <td className={`${CELDA} min-w-[180px]`}>
        <p className="text-sm font-medium text-gray-900">{audiencia.usuaria.nombreCompleto}</p>
        {audiencia.descripcion && <p className="mt-0.5 text-xs text-gray-500">{audiencia.descripcion}</p>}
      </td>
      <td className={CELDA}>
        <Link
          to={RUTAS_JURIDICO.proceso(audiencia.procesoId)}
          className="whitespace-nowrap text-sm font-medium text-brand-700 tabular-nums hover:underline"
        >
          {audiencia.codigoProceso}
        </Link>
        {audiencia.numeroJudicial ? (
          <p title={audiencia.numeroJudicial} className="mt-0.5 max-w-[220px] truncate text-xs text-gray-500">
            {audiencia.numeroJudicial}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-gray-400">Sin No. judicial</p>
        )}
      </td>
      <td className={`${CELDA} whitespace-nowrap text-sm text-gray-700`}>{audiencia.responsable.nombre}</td>
      {vista === 'historial' && (
        <td className={CELDA}>
          <EtiquetaEstadoAudiencia estado={audiencia.estadoVisible} />
          {origen && <p className="mt-1 max-w-[160px] text-xs text-gray-500">{origen}</p>}
        </td>
      )}
      <td className={CELDA}>
        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
          {principal && IconoPrincipal && principal === 'REGISTRAR_RESULTADO' && (
            <Button tamano="sm" onClick={() => onAccion(principal, audiencia)}>
              <IconoPrincipal size={15} aria-hidden="true" />
              {ETIQUETAS_ACCION_AUDIENCIA[principal]}
            </Button>
          )}
          {/* Lo demás (reprogramar, agendar) queda visible pero en segundo plano: lo urgente es el resultado. */}
          {principal && IconoPrincipal && principal !== 'REGISTRAR_RESULTADO' && (
            <button
              type="button"
              onClick={() => onAccion(principal, audiencia)}
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <IconoPrincipal size={15} aria-hidden="true" className="text-gray-500" />
              {ETIQUETAS_ACCION_AUDIENCIA[principal]}
            </button>
          )}
          <MenuAcciones opciones={opciones} etiqueta={`Más acciones de la audiencia de ${audiencia.codigoProceso}`} />
        </div>
      </td>
    </tr>
  )
}
