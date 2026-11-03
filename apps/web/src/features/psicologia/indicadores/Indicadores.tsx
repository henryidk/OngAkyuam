import { useCallback, useMemo, useState } from 'react'
import { anioActualGT, exportarPsicologiaQuerySchema, type ExportarPsicologiaQuery } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { guardarArchivo } from '../../../lib/archivos'
import { useRecurso } from '../../../lib/useRecurso'
import { descargarIndicadores, obtenerIndicadores } from '../api/psicologia.api'
import BarrasPorMes from './BarrasPorMes'
import SelectorAnio from './SelectorAnio'
import TablaDesglose from './TablaDesglose'
import TarjetasKpi from './TarjetasKpi'

const CLASES_FECHA =
  'rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

/** Rango del Excel por defecto: el año completo que se está viendo. */
function rangoDelAnio(anio: number): ExportarPsicologiaQuery {
  return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` }
}

/**
 * Reportes del módulo: cifras de mis procesos en un año (solo números, sin nombres). El Excel de
 * personas atendidas se descarga por rango de fechas, que empieza siendo el año a la vista.
 */
export default function Indicadores() {
  const [anio, setAnio] = useState(anioActualGT)
  const [mes, setMes] = useState<number | null>(null)
  const [rango, setRango] = useState<ExportarPsicologiaQuery>(() => rangoDelAnio(anioActualGT()))
  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  const cargar = useCallback(() => obtenerIndicadores({ anio }), [anio])
  const { datos, error, recargar } = useRecurso(cargar)

  // El mismo schema que valida el backend: fechas reales y "Desde" antes de "Hasta".
  const validacion = useMemo(() => exportarPsicologiaQuerySchema.safeParse(rango), [rango])
  const rangoValido = validacion.success ? validacion.data : null
  const errorRango = validacion.success ? null : (validacion.error.issues[0]?.message ?? 'Rango inválido')

  function cambiarAnio(nuevo: number) {
    setAnio(nuevo)
    setMes(null)
    setRango(rangoDelAnio(nuevo))
  }

  async function descargar() {
    if (!rangoValido) return
    setDescargando(true)
    setErrorDescarga(null)
    try {
      guardarArchivo(
        await descargarIndicadores(rangoValido),
        `psicologia-personas-atendidas_${rangoValido.desde}_${rangoValido.hasta}.xlsx`,
      )
    } catch {
      // La respuesta de error llega como Blob, no como JSON: se muestra un mensaje genérico.
      setErrorDescarga('No se pudo generar el Excel. Intenta de nuevo en un momento.')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Reportes</p>
          <h1 className="text-2xl font-semibold text-gray-900">Estadísticas de Psicología</h1>
          <p className="text-sm text-gray-500">
            Edad, etnia y tipología vienen de Trabajo Social; no se vuelven a capturar.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <SelectorAnio anio={anio} anios={datos?.aniosDisponibles ?? [anio]} onCambiar={cambiarAnio} />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Excel desde</span>
            <input
              type="date"
              value={rango.desde}
              max={rango.hasta}
              onChange={(event) => setRango({ ...rango, desde: event.target.value })}
              className={CLASES_FECHA}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Hasta</span>
            <input
              type="date"
              value={rango.hasta}
              min={rango.desde}
              onChange={(event) => setRango({ ...rango, hasta: event.target.value })}
              className={CLASES_FECHA}
            />
          </label>
          <Button
            tamano="md"
            cargando={descargando}
            disabled={!datos || !rangoValido}
            onClick={() => void descargar()}
          >
            Descargar Excel
          </Button>
        </div>
      </div>

      {errorRango && (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{errorRango}</p>
      )}

      {errorDescarga && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorDescarga}
        </p>
      )}

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error.mensaje}</span>
          {!error.sinPermiso && (
            <Button variante="secondary" onClick={() => void recargar()}>
              Reintentar
            </Button>
          )}
        </div>
      )}

      {!error && !datos && <p className="text-sm text-gray-500">Cargando estadísticas…</p>}

      {datos && (
        <>
          <TarjetasKpi datos={datos} />
          <BarrasPorMes anio={anio} meses={datos.meses} mesSeleccionado={mes} onElegir={setMes} />
          <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
            <TablaDesglose titulo="Por rango de edad" filas={datos.anual.desgloses.rangoEdad} />
            <TablaDesglose titulo="Por grupo étnico" filas={datos.anual.desgloses.grupoEtnico} />
            <TablaDesglose titulo="Por tipología 22-2008" filas={datos.anual.desgloses.tipologia} />
          </div>
        </>
      )}
    </div>
  )
}
