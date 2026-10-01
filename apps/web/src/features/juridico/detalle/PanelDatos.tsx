import { Link } from 'react-router-dom'
import { ETIQUETAS_TIPO_PROCESO_JURIDICO, formatFechaGT, type ProcesoDetalle } from '@akyuam/shared'
import { RUTAS_JURIDICO } from '../rutas'

const SIN_DATO = '—'

export default function PanelDatos({ proceso, onEditar }: { proceso: ProcesoDetalle; onEditar: () => void }) {
  const filas: [string, string][] = [
    ['No. interno', proceso.codigo],
    ['No. judicial', proceso.numeroJudicial || SIN_DATO],
    ['Juzgado u órgano', proceso.organoJudicial || SIN_DATO],
    ['Contraparte', proceso.contraparte || SIN_DATO],
    ['Abogada', proceso.abogada?.nombre ?? 'Sin asignar'],
    ['Procuradora', proceso.procuradora?.nombre ?? 'Sin asignar'],
    ['Fecha de inicio', formatFechaGT(proceso.fechaInicio)],
  ]
  if (proceso.fechaCierre) filas.push(['Fecha de cierre', formatFechaGT(proceso.fechaCierre)])

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Datos del proceso</h3>
        <button type="button" onClick={onEditar} className="text-xs font-medium text-brand-700 hover:underline">
          Editar
        </button>
      </div>
      <dl className="mt-3 space-y-2.5">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">{etiqueta}</dt>
            <dd className="text-sm text-gray-900">{valor}</dd>
          </div>
        ))}
        {proceso.procesoOrigen && (
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-gray-500">Proceso de origen</dt>
            <dd className="text-sm">
              <Link to={RUTAS_JURIDICO.proceso(proceso.procesoOrigen.id)} className="text-brand-700 hover:underline">
                {proceso.procesoOrigen.codigo} · {ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.procesoOrigen.tipo]}
              </Link>
            </dd>
          </div>
        )}
      </dl>
    </section>
  )
}
