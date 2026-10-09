import { useCallback, useState } from 'react'
import { anioActualGT } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { guardarArchivo } from '../../../lib/archivos'
import { useRecurso } from '../../../lib/useRecurso'
import { descargarIndicadores, obtenerIndicadores } from '../api/psicologia.api'
import BarrasPorMes from './BarrasPorMes'
import SelectorAnio from './SelectorAnio'
import TablaDesglose from './TablaDesglose'
import TarjetasKpi from './TarjetasKpi'

/** Reportes del módulo: cifras de mis procesos en un año. Solo números, sin nombres. */
export default function Indicadores() {
  const [anio, setAnio] = useState(anioActualGT)
  const [mes, setMes] = useState<number | null>(null)
  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  const cargar = useCallback(() => obtenerIndicadores({ anio }), [anio])
  const { datos, error, recargar } = useRecurso(cargar)

  function cambiarAnio(nuevo: number) {
    setAnio(nuevo)
    setMes(null)
  }

  async function descargar() {
    setDescargando(true)
    setErrorDescarga(null)
    try {
      guardarArchivo(await descargarIndicadores({ anio }), `psicologia-personas-atendidas_${anio}.xlsx`)
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
        <div className="flex items-center gap-2">
          <SelectorAnio anio={anio} anios={datos?.aniosDisponibles ?? [anio]} onCambiar={cambiarAnio} />
          <Button tamano="md" cargando={descargando} disabled={!datos} onClick={() => void descargar()}>
            Descargar Excel
          </Button>
        </div>
      </div>

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
