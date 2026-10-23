import type { AccionAudiencia, AudienciaDetalleDto } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { etiquetaAccionAudiencia, separarAcciones } from './formato'
import { ICONOS_ACCION_AUDIENCIA } from './iconosAccion'

interface BarraAccionesAudienciaProps {
  audiencia: AudienciaDetalleDto
  onAccion: (accion: AccionAudiencia, audiencia: AudienciaDetalleDto) => void
}

/**
 * Todas las acciones de la audiencia a la vista, cada una con su icono y su nombre: antes vivían
 * en un menú "⋯" que costaba descubrir. La principal va destacada; cancelar, al final y en rojo.
 */
export default function BarraAccionesAudiencia({ audiencia, onAccion }: BarraAccionesAudienciaProps) {
  const { principal, secundarias } = separarAcciones(audiencia.accionesDisponibles)
  if (!principal && secundarias.length === 0) return null

  return (
    <div role="group" aria-label="Acciones de la audiencia" className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-3">
      {principal && <BotonAccion accion={principal} audiencia={audiencia} destacada onAccion={onAccion} />}
      {secundarias.map((accion) => (
        <BotonAccion key={accion} accion={accion} audiencia={audiencia} onAccion={onAccion} />
      ))}
    </div>
  )
}

function BotonAccion({
  accion,
  audiencia,
  destacada = false,
  onAccion,
}: BarraAccionesAudienciaProps & { accion: AccionAudiencia; destacada?: boolean }) {
  const Icono = ICONOS_ACCION_AUDIENCIA[accion]
  const etiqueta = etiquetaAccionAudiencia(accion, audiencia)

  if (destacada) {
    return (
      <Button
        tamano="sm"
        variante={accion === 'REGISTRAR_RESULTADO' ? 'primary' : 'secondary'}
        onClick={() => onAccion(accion, audiencia)}
      >
        <Icono size={15} aria-hidden="true" />
        {etiqueta}
      </Button>
    )
  }

  const peligro = accion === 'CANCELAR'
  return (
    <button
      type="button"
      onClick={() => onAccion(accion, audiencia)}
      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
        peligro ? 'text-red-700 hover:bg-red-50 sm:ml-auto' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icono size={15} aria-hidden="true" className={peligro ? undefined : 'text-gray-500'} />
      {etiqueta}
    </button>
  )
}
