import type { EstadoProcesoReportePsicologia, IndicadoresQuery } from '@akyuam/shared'

/** Los filtros que comparten las cifras y el Excel (el periodo va aparte). */
export type FiltrosPsicologia = Pick<IndicadoresQuery, 'profesional' | 'estadoProceso' | 'incluirNinos'>

export const FILTROS_INICIALES: FiltrosPsicologia = {
  profesional: 'EQUIPO',
  estadoProceso: 'TODOS',
  incluirNinos: true,
}

const OPCIONES_ESTADO: { valor: EstadoProcesoReportePsicologia; etiqueta: string }[] = [
  { valor: 'TODOS', etiqueta: 'Todos' },
  { valor: 'EN_ATENCION', etiqueta: 'En atención' },
  { valor: 'CONCLUIDOS', etiqueta: 'Concluidos' },
]

const CLASES_CAMPO =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

interface FiltrosIndicadoresProps {
  filtros: FiltrosPsicologia
  onCambiar: (filtros: FiltrosPsicologia) => void
}

/** Procesos (míos o de todo el equipo), estado del proceso e hijas/hijos: aplican igual a las cifras y al Excel. */
export default function FiltrosIndicadores({ filtros, onCambiar }: FiltrosIndicadoresProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">Procesos</span>
        <select
          value={filtros.profesional}
          onChange={(event) =>
            onCambiar({ ...filtros, profesional: event.target.value as FiltrosPsicologia['profesional'] })
          }
          className={CLASES_CAMPO}
        >
          <option value="EQUIPO">Todos los procesos</option>
          <option value="MIOS">Mis procesos</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">Estado del proceso</span>
        <select
          value={filtros.estadoProceso}
          onChange={(event) =>
            onCambiar({ ...filtros, estadoProceso: event.target.value as EstadoProcesoReportePsicologia })
          }
          className={CLASES_CAMPO}
        >
          {OPCIONES_ESTADO.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={filtros.incluirNinos}
          onChange={(event) => onCambiar({ ...filtros, incluirNinos: event.target.checked })}
          className="h-4 w-4 rounded border-gray-300 accent-brand-600"
        />
        Incluir hijas e hijos
      </label>
    </div>
  )
}
