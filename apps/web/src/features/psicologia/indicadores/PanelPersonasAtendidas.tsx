import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { FILAS_POR_PAGINA_PERSONAS_PSICOLOGIA, exportarPsicologiaQuerySchema } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import EmptyState from '../../../components/ui/EmptyState'
import { guardarArchivo } from '../../../lib/archivos'
import { useRecurso } from '../../../lib/useRecurso'
import Paginacion from '../../../components/ui/Paginacion'
import { descargarIndicadores, listarPersonasAtendidas } from '../api/psicologia.api'
import type { FiltrosPsicologia } from './FiltrosIndicadores'
import TablaPersonasAtendidas from './TablaPersonasAtendidas'

const CLASES_FECHA =
  'rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

export interface Rango {
  desde: string
  hasta: string
}

interface PanelPersonasAtendidasProps {
  filtros: FiltrosPsicologia
  rango: Rango
  onCambiarRango: (rango: Rango) => void
  /** Para el número de la pestaña: el total del rango y filtros actuales. */
  onTotal: (total: number) => void
}

function plural(n: number) {
  return `${n} ${n === 1 ? 'persona' : 'personas'}`
}

/**
 * La tabla del Excel en pantalla, con su periodo y su descarga. El periodo arranca en el año o mes
 * elegido arriba y se puede ajustar a mano; tabla y Excel siempre muestran lo mismo.
 */
export default function PanelPersonasAtendidas({ filtros, rango, onCambiarRango, onTotal }: PanelPersonasAtendidasProps) {
  const [pagina, setPagina] = useState(1)
  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  // El mismo schema que valida el backend: fechas reales y "Desde" antes de "Hasta".
  const validacion = useMemo(() => exportarPsicologiaQuerySchema.safeParse({ ...rango, ...filtros }), [rango, filtros])
  const consulta = validacion.success ? validacion.data : null
  const errorRango = validacion.success ? null : (validacion.error.issues[0]?.message ?? 'Rango inválido')

  // Otro periodo u otros filtros: de vuelta a la primera página.
  useEffect(() => setPagina(1), [consulta?.desde, consulta?.hasta, filtros])

  const cargar = useCallback(
    () => (consulta ? listarPersonasAtendidas({ ...consulta, pagina }) : Promise.resolve(null)),
    [consulta, pagina],
  )
  const { datos, error, cargando, recargar } = useRecurso(cargar)

  useEffect(() => {
    if (datos) onTotal(datos.total)
  }, [datos, onTotal])

  async function descargar() {
    if (!consulta) return
    setDescargando(true)
    setErrorDescarga(null)
    try {
      guardarArchivo(
        await descargarIndicadores(consulta),
        `psicologia-personas-atendidas_${consulta.desde}_${consulta.hasta}.xlsx`,
      )
    } catch {
      // La respuesta de error llega como Blob, no como JSON: se muestra un mensaje genérico.
      setErrorDescarga('No se pudo generar el Excel. Intenta de nuevo en un momento.')
    } finally {
      setDescargando(false)
    }
  }

  const hayFilas = datos !== null && datos.total > 0

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-gray-900">Personas atendidas</h2>
          <p className="text-[13px] text-gray-500">
            {datos ? `${plural(datos.total)} · ` : ''}mismas columnas que el Excel, sin nombres
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Desde</span>
            <input
              type="date"
              value={rango.desde}
              max={rango.hasta}
              onChange={(event) => onCambiarRango({ ...rango, desde: event.target.value })}
              className={CLASES_FECHA}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Hasta</span>
            <input
              type="date"
              value={rango.hasta}
              min={rango.desde}
              onChange={(event) => onCambiarRango({ ...rango, hasta: event.target.value })}
              className={CLASES_FECHA}
            />
          </label>
          <Button tamano="md" cargando={descargando} disabled={!consulta || !hayFilas} onClick={() => void descargar()}>
            Descargar Excel
          </Button>
        </div>
      </div>

      {(errorRango || errorDescarga || error) && (
        <div className="space-y-2 px-5 pb-4">
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
        </div>
      )}

      {consulta && !datos && !error && cargando && (
        <div className="space-y-2 px-5 pb-5">
          {[0, 1, 2, 3, 4].map((indice) => (
            <div key={indice} className="h-6 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      )}

      {datos && !hayFilas && (
        <div className="border-t border-gray-100 p-4">
          <EmptyState
            Icono={FileSpreadsheet}
            titulo="Nadie fue atendida en este periodo con estos filtros"
            descripcion="Prueba con otro rango de fechas, otra psicóloga u otro estado del proceso."
          />
        </div>
      )}

      {datos && hayFilas && (
        <div className="border-t border-gray-100">
          <TablaPersonasAtendidas filas={datos.filas} />
          {datos.total > FILAS_POR_PAGINA_PERSONAS_PSICOLOGIA && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-[#fcfcfd] px-5 py-3 text-[13px] text-gray-500">
              <span className="tabular-nums">
                Mostrando {datos.filas[0]?.numero}–{datos.filas.at(-1)?.numero} de {plural(datos.total)}
              </span>
              <Paginacion
                etiqueta="Paginación de personas atendidas"
                pagina={datos.pagina}
                pageSize={FILAS_POR_PAGINA_PERSONAS_PSICOLOGIA}
                total={datos.total}
                onCambiar={setPagina}
              />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
