import { useSearchParams } from 'react-router-dom'
import { useTituloPagina } from '../../../components/TituloPagina'
import { useContextoPsicologia } from '../compartido/contexto'
import type { VistaConsultasPsicologia } from '../rutas'
import HistorialConsultas from './historial/HistorialConsultas'
import ListaPorRegistrar from './porRegistrar/ListaPorRegistrar'

const PESTANAS: { vista: VistaConsultasPsicologia; etiqueta: string }[] = [
  { vista: 'por-registrar', etiqueta: 'Por registrar' },
  { vista: 'historial', etiqueta: 'Historial' },
]

/**
 * Consultas: las sesiones que me toca registrar y el historial de las realizadas. La pestaña vive
 * en la URL (`?vista=historial`) para que recargar o volver atrás caiga en la misma.
 */
export default function PaginaConsultas() {
  useTituloPagina({ titulo: 'Consultas' })
  const [params, setParams] = useSearchParams()
  const { resumen } = useContextoPsicologia()
  const vista: VistaConsultasPsicologia = params.get('vista') === 'historial' ? 'historial' : 'por-registrar'
  const porRegistrar = resumen?.sesionesPorRegistrar ?? 0

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {vista === 'historial' ? 'Historial de sesiones' : 'Sesiones por registrar'}
        </h1>
        <p className="text-sm text-gray-500">
          {vista === 'historial'
            ? 'Abre una sesión para ver sus notas. Cada apertura queda registrada.'
            : 'Registra la sesión o la inasistencia de cada cita que ya empezó.'}
        </p>
      </div>

      <nav aria-label="Secciones de consultas" className="flex gap-1 border-b border-gray-200">
        {PESTANAS.map((pestana) => {
          const activa = pestana.vista === vista
          return (
            <button
              key={pestana.vista}
              type="button"
              aria-current={activa ? 'page' : undefined}
              onClick={() => setParams(pestana.vista === 'historial' ? { vista: 'historial' } : {})}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${
                activa ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {pestana.etiqueta}
              {pestana.vista === 'por-registrar' && porRegistrar > 0 && (
                <span className="ml-1.5 tabular-nums text-gray-500">{porRegistrar}</span>
              )}
            </button>
          )
        })}
      </nav>

      {vista === 'historial' ? <HistorialConsultas /> : <ListaPorRegistrar />}
    </div>
  )
}
