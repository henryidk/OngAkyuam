import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ETIQUETAS_ESTADO_CITA_PSICOLOGICA,
  ETIQUETAS_MODALIDAD_CITA,
  ETIQUETAS_TIPO_CITA_PSICOLOGICA,
  formatInstanteGT,
  type CitaPsicologicaDetalle,
} from '@akyuam/shared'
import Badge from '../../../components/ui/Badge'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerDetalleCita } from '../api/psicologia.api'
import { RUTAS_PSICOLOGIA } from '../rutas'
import CodigoProceso from '../compartido/CodigoProceso'

export default function DetalleCita() {
  const { citaId } = useParams<{ citaId: string }>()
  const [cita, setCita] = useState<CitaPsicologicaDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!citaId) return
    setError(null)
    try {
      setCita(await obtenerDetalleCita(citaId))
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [citaId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  if (error) {
    return <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
  }

  if (!cita) {
    return <p className="text-sm text-gray-500">Cargando cita…</p>
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-gray-800">
          {cita.ninoNombreCompleto ?? cita.usuariaNombreCompleto}
        </h1>
        <Badge>{ETIQUETAS_ESTADO_CITA_PSICOLOGICA[cita.estado]}</Badge>
      </div>

      <dl className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-gray-500">Fecha y hora</dt>
          <dd className="text-sm font-medium text-gray-800">{formatInstanteGT(cita.fechaHora)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Modalidad</dt>
          <dd className="text-sm font-medium text-gray-800">{ETIQUETAS_MODALIDAD_CITA[cita.modalidad]}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Tipo</dt>
          <dd className="text-sm font-medium text-gray-800">{ETIQUETAS_TIPO_CITA_PSICOLOGICA[cita.tipo]}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Duración</dt>
          <dd className="text-sm font-medium text-gray-800">{cita.duracionMinutos} minutos</dd>
        </div>
        {cita.lugar && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-gray-500">Lugar</dt>
            <dd className="text-sm font-medium text-gray-800">{cita.lugar}</dd>
          </div>
        )}
        <div className="sm:col-span-2">
          <dt className="text-xs text-gray-500">Motivo</dt>
          <dd className="text-sm text-gray-800">{cita.motivo}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-3 text-sm font-medium">
        {cita.estado === 'PROGRAMADA' && (
          <Link to={RUTAS_PSICOLOGIA.registrarConsulta(cita.id)} className="text-brand-600 hover:underline">
            Registrar sesión
          </Link>
        )}
        <Link to={RUTAS_PSICOLOGIA.proceso(cita.procesoId)} className="text-gray-600 hover:underline">
          Ver proceso <CodigoProceso codigo={cita.procesoCodigo} />
        </Link>
      </div>
    </div>
  )
}
