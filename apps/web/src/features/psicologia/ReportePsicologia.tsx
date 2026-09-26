import { useCallback, useEffect, useState } from 'react'
import {
  ESTADOS_CITA_PSICOLOGICA,
  ETIQUETAS_ESTADO_CITA_PSICOLOGICA,
  ETIQUETAS_MODALIDAD_CITA,
  MODALIDADES_CITA,
  hoyGT,
  type ReportePsicologia as ReportePsicologiaDto,
} from '@akyuam/shared'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'

export default function ReportePsicologia() {
  const [desde, setDesde] = useState(hoyGT())
  const [hasta, setHasta] = useState(hoyGT())
  const [reporte, setReporte] = useState<ReportePsicologiaDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargarReporte = useCallback(async () => {
    setReporte(null)
    setError(null)
    try {
      const { data } = await api.get<ReportePsicologiaDto>('/psicologia/reporte', { params: { desde, hasta } })
      setReporte(data)
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [desde, hasta])

  useEffect(() => {
    void cargarReporte()
  }, [cargarReporte])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500">Desde</span>
          <input
            type="date"
            value={desde}
            onChange={(event) => setDesde(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500">Hasta</span>
          <input
            type="date"
            value={hasta}
            onChange={(event) => setHasta(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!error && reporte === null && <p className="text-sm text-gray-500">Cargando reporte…</p>}

      {!error && reporte !== null && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TarjetaMetrica etiqueta="Total de citas" valor={reporte.totalCitas} />
            <TarjetaMetrica etiqueta="Usuarias atendidas" valor={reporte.usuariasAtendidas} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-gray-800">Por estado</h3>
              <dl className="divide-y divide-gray-100">
                {ESTADOS_CITA_PSICOLOGICA.map((estado) => (
                  <div key={estado} className="flex justify-between py-1.5 text-sm">
                    <dt className="text-gray-500">{ETIQUETAS_ESTADO_CITA_PSICOLOGICA[estado]}</dt>
                    <dd className="font-medium text-gray-800">{reporte.porEstado[estado]}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-gray-800">Por modalidad</h3>
              <dl className="divide-y divide-gray-100">
                {MODALIDADES_CITA.map((modalidad) => (
                  <div key={modalidad} className="flex justify-between py-1.5 text-sm">
                    <dt className="text-gray-500">{ETIQUETAS_MODALIDAD_CITA[modalidad]}</dt>
                    <dd className="font-medium text-gray-800">{reporte.porModalidad[modalidad]}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function TarjetaMetrica({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{etiqueta}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-800">{valor}</p>
    </div>
  )
}
