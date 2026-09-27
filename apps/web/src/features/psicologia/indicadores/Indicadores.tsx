import { useCallback, useEffect, useState } from 'react'
import {
  ETIQUETAS_ESTADO_CITA_PSICOLOGICA,
  ETIQUETAS_TIPO_CITA_PSICOLOGICA,
  type IndicadoresPsicologia,
} from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerIndicadores } from '../api/psicologia.api'

const ANIO_ACTUAL = new Date().getFullYear()
const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function TarjetaMetrica({ etiqueta, valor }: { etiqueta: string; valor: number | string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{etiqueta}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-800">{valor}</p>
    </div>
  )
}

function TablaDistribucion({ titulo, datos, formatearClave }: { titulo: string; datos: Record<string, number>; formatearClave?: (clave: string) => string }) {
  const filas = Object.entries(datos)
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-800">{titulo}</h3>
      {filas.length === 0 ? (
        <p className="text-sm text-gray-400">Sin datos.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-gray-100">
            {filas.map(([clave, valor]) => (
              <tr key={clave}>
                <td className="py-1.5 text-gray-600">{formatearClave ? formatearClave(clave) : clave}</td>
                <td className="py-1.5 text-right font-medium text-gray-800">{valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export default function Indicadores() {
  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [datos, setDatos] = useState<IndicadoresPsicologia | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      setDatos(await obtenerIndicadores({ anio }))
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [anio])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500">Año</span>
          <input
            type="number"
            value={anio}
            onChange={(event) => setAnio(Number(event.target.value))}
            className="w-28 rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!error && !datos && <p className="text-sm text-gray-500">Cargando indicadores…</p>}

      {datos && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <TarjetaMetrica etiqueta="Procesos activos" valor={datos.procesosActivos} />
            <TarjetaMetrica etiqueta="Iniciados en el año" valor={datos.procesosIniciadosEnElAnio} />
            <TarjetaMetrica etiqueta="Cerrados en el año" valor={datos.procesosCerradosEnElAnio} />
            <TarjetaMetrica etiqueta="Personas atendidas en el año" valor={datos.personasAtendidasEnElAnio} />
            <TarjetaMetrica etiqueta="Tasa de inasistencia" valor={`${(datos.tasaInasistencia * 100).toFixed(1)}%`} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TablaDistribucion
              titulo="Personas atendidas por mes"
              datos={datos.personasAtendidasPorMes}
              formatearClave={(mes) => NOMBRES_MES[Number(mes) - 1] ?? mes}
            />
            <TablaDistribucion
              titulo="Citas por estado"
              datos={datos.citasPorEstado}
              formatearClave={(estado) => ETIQUETAS_ESTADO_CITA_PSICOLOGICA[estado as keyof typeof ETIQUETAS_ESTADO_CITA_PSICOLOGICA] ?? estado}
            />
            <TablaDistribucion titulo="Distribución por municipio" datos={datos.distribucionPorMunicipio} />
            <TablaDistribucion
              titulo="Distribución por tipo de cita"
              datos={datos.distribucionPorTipoCita}
              formatearClave={(tipo) => ETIQUETAS_TIPO_CITA_PSICOLOGICA[tipo as keyof typeof ETIQUETAS_TIPO_CITA_PSICOLOGICA] ?? tipo}
            />
          </div>
        </>
      )}
    </div>
  )
}
