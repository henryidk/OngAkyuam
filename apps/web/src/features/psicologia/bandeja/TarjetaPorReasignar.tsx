import { ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA, type CasoPorReasignarDto } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { fechaDeInstante, iniciales } from '../../../lib/formato'
import { etiquetaPersona } from '../compartido/personas'

interface TarjetaPorReasignarProps {
  caso: CasoPorReasignarDto
  /** Mientras se toma otro caso no se puede tomar este: evita dos tomas a la vez. */
  deshabilitada: boolean
  onTomar: () => void
}

function textoSesiones(sesiones: number): string {
  if (sesiones === 0) return 'Sin sesiones registradas'
  return sesiones === 1 ? '1 sesión registrada' : `${sesiones} sesiones registradas`
}

/** Caso o proceso abierto que se quedó sin psicóloga: se distingue de una referencia nueva. */
export default function TarjetaPorReasignar({ caso, deshabilitada, onTomar }: TarjetaPorReasignarProps) {
  const abierto = caso.codigo !== null
  const detalle = abierto
    ? [
        caso.codigo,
        `Exp. ${caso.expedienteNumero}`,
        `Etapa ${ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA[caso.etapa]}`,
        textoSesiones(caso.sesionesAtendidas),
      ]
    : [`Exp. ${caso.expedienteNumero}`, 'Tomado, sin primera cita']

  return (
    <article className="overflow-hidden rounded-xl border border-amber-200 bg-white">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-800"
          >
            {iniciales(caso.usuariaNombreCompleto)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900">{caso.usuariaNombreCompleto}</h3>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                {abierto ? 'Proceso abierto' : 'Caso sin primera cita'}
              </span>
            </div>
            <p className="mt-0.5 text-[13px] text-gray-500 tabular-nums">{detalle.join(' · ')}</p>
          </div>
        </div>

        <div className="mt-4 space-y-1.5 text-sm text-gray-600">
          <p>
            <span className="font-medium text-gray-700">Lo llevaba:</span> {caso.psicologaAnterior}
            {caso.fechaInicio && <> · desde el {fechaDeInstante(caso.fechaInicio)}</>}
          </p>
          <p>
            <span className="font-medium text-gray-700">Personas a atender:</span>{' '}
            {caso.personas.map(etiquetaPersona).join(', ')}
          </p>
          {caso.citasProgramadas > 0 && (
            <p className="text-amber-800">
              {caso.citasProgramadas === 1
                ? 'Tiene 1 cita programada que se cancelará al tomarlo.'
                : `Tiene ${caso.citasProgramadas} citas programadas que se cancelarán al tomarlo.`}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-amber-100 bg-amber-50/40 px-5 py-3">
        <Button disabled={deshabilitada} onClick={onTomar}>
          Tomar caso
        </Button>
      </div>
    </article>
  )
}
