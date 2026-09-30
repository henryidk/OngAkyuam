import { Link, useParams } from 'react-router-dom'
import { ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA, formatInstanteGT } from '@akyuam/shared'
import Badge from '../../../components/ui/Badge'
import { useExpedientePsicologia } from '../hooks/useExpedientePsicologia'
import FilaCita from '../citas/FilaCita'
import { RUTAS_PSICOLOGIA } from '../rutas'

export default function PestanaResumen() {
  const { expedienteId } = useParams<{ expedienteId: string }>()
  const { resumen, error } = useExpedientePsicologia(expedienteId ?? '')

  if (error) {
    return <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
  }

  if (!resumen) {
    return <p className="text-sm text-gray-500">Cargando resumen…</p>
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-800">{resumen.usuariaNombreCompleto}</h2>
          <Badge>{ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA[resumen.estado]}</Badge>
        </div>
        <p className="mt-1 text-sm text-gray-500">Expediente {resumen.numero}</p>
        <dl className="mt-4 grid gap-2 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-gray-500">Total de citas</dt>
            <dd className="text-sm font-medium text-gray-800">{resumen.totalCitas}</dd>
          </div>
          {resumen.tomadaEn && (
            <div>
              <dt className="text-xs text-gray-500">Caso tomado</dt>
              <dd className="text-sm font-medium text-gray-800">{formatInstanteGT(resumen.tomadaEn)}</dd>
            </div>
          )}
          {resumen.fechaCierre && (
            <div>
              <dt className="text-xs text-gray-500">Fecha de cierre</dt>
              <dd className="text-sm font-medium text-gray-800">{formatInstanteGT(resumen.fechaCierre)}</dd>
            </div>
          )}
        </dl>
        {resumen.motivoCierre && (
          <p className="mt-3 text-sm text-gray-700">
            <span className="font-medium text-gray-500">Motivo de cierre: </span>
            {resumen.motivoCierre}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-800">Próxima cita</h3>
        {resumen.proximaCita ? (
          <FilaCita
            cita={resumen.proximaCita}
            expedienteId={resumen.expedienteId}
            mostrarRegistrarConsulta
            mostrarReprogramar
          />
        ) : (
          <p className="text-sm text-gray-500">
            No hay una próxima cita agendada.{' '}
            <Link
              to={RUTAS_PSICOLOGIA.nuevaCita({ expedienteId: resumen.expedienteId })}
              className="font-medium text-brand-600 hover:underline"
            >
              Agendar cita
            </Link>
          </p>
        )}
      </section>

      {resumen.historialEstados.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-gray-800">Historial del proceso</h3>
          <ul className="space-y-2 text-sm">
            {resumen.historialEstados.map((cambio) => (
              <li key={cambio.id} className="flex justify-between gap-3 text-gray-700">
                <span>
                  {cambio.estadoAnterior ? `${ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA[cambio.estadoAnterior]} → ` : ''}
                  {ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA[cambio.estadoNuevo]}
                </span>
                <span className="text-xs text-gray-500">{formatInstanteGT(cambio.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
