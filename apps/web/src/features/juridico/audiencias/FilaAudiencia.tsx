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
import { RUTAS_JURIDICO } from '../rutas'
import EtiquetaEstadoAudiencia from './EtiquetaEstadoAudiencia'
import { ETIQUETAS_ACCION_AUDIENCIA, separarAcciones, textoEspera } from './formato'
import { ICONOS_ACCION_AUDIENCIA } from './iconosAccion'
import MenuAcciones from './MenuAcciones'

interface FilaAudienciaProps {
  audiencia: AudienciaFilaDto
  vista: VistaAudiencias
  onAccion: (accion: AccionAudiencia, audiencia: AudienciaFilaDto) => void
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
    <tr className="border-t border-gray-100 align-top">
      <td className="min-w-[150px] px-3 py-3">
        <p className="text-sm font-medium text-gray-900">{audiencia.usuaria.nombreCompleto}</p>
        <p className="text-xs text-gray-500 tabular-nums">Exp. {audiencia.expedienteNumero}</p>
      </td>
      <td className="px-3 py-3">
        <Link
          to={RUTAS_JURIDICO.proceso(audiencia.procesoId)}
          className="font-mono text-[13px] font-medium text-brand-700 hover:underline"
        >
          {audiencia.codigoProceso}
        </Link>
        {audiencia.descripcion && <p className="mt-0.5 max-w-[180px] text-xs text-gray-500">{audiencia.descripcion}</p>}
      </td>
      <td className="px-3 py-3">
        {audiencia.numeroJudicial ? (
          <p
            title={audiencia.numeroJudicial}
            className="line-clamp-3 min-w-[180px] max-w-[240px] text-[13px] leading-snug break-words text-gray-700"
          >
            {audiencia.numeroJudicial}
          </p>
        ) : (
          <span className="whitespace-nowrap text-xs text-gray-400">Sin No. judicial</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-900 tabular-nums">
        {formatFechaGT(audiencia.fecha)}
        {vista === 'pendientes' && (
          <p className="text-xs font-medium text-[#8a5a14]">{textoEspera(diasDesdeFechaGT(audiencia.fecha))}</p>
        )}
      </td>
      <td className="px-3 py-3 text-sm text-gray-900 tabular-nums">{audiencia.hora}</td>
      <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-700">{audiencia.responsable.nombre}</td>
      <td className="px-3 py-3">
        <EtiquetaEstadoAudiencia estado={audiencia.estadoVisible} />
        {origen && <p className="mt-1 max-w-[160px] text-xs text-gray-500">{origen}</p>}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          {principal && (
            <Button
              tamano="sm"
              variante={principal === 'REGISTRAR_RESULTADO' ? 'primary' : 'secondary'}
              onClick={() => onAccion(principal, audiencia)}
            >
              {IconoPrincipal && <IconoPrincipal size={15} aria-hidden="true" />}
              {ETIQUETAS_ACCION_AUDIENCIA[principal]}
            </Button>
          )}
          <MenuAcciones opciones={opciones} etiqueta={`Más acciones de la audiencia de ${audiencia.codigoProceso}`} />
        </div>
      </td>
    </tr>
  )
}
