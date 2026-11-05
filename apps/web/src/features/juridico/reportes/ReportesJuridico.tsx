import { useMemo, useRef, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import {
  anioActualGT,
  FILAS_POR_PAGINA_REPORTE_JURIDICO,
  formatFechaGT,
  reporteProcesosJuridicoQuerySchema,
  type ReporteProcesosJuridicoQuery,
} from '@akyuam/shared'
import DesgloseBarras, { DesgloseEsqueleto } from '../../../components/reportes/DesgloseBarras'
import EmptyState from '../../../components/ui/EmptyState'
import { guardarArchivo } from '../../../lib/archivos'
import { descargarReporteProcesos } from '../api/juridico.api'
import { CLASES_BARRA, CLASES_BARRA_FORMA } from '../compartido/colores'
import { useContextoJuridico } from '../compartido/contexto'
import Paginacion from '../../../components/ui/Paginacion'
import FiltrosReporteJuridico from './FiltrosReporteJuridico'
import TablaReporteJuridico from './TablaReporteJuridico'
import { useReporteProcesos } from './useReporteProcesos'

/**
 * Por defecto, la carpeta del año en curso (hora de Guatemala) sin fechas: todos sus procesos. Las
 * fechas, si se llenan, acotan esa carpeta por fecha de inicio del proceso.
 */
function filtrosIniciales(): ReporteProcesosJuridicoQuery {
  return { anio: anioActualGT(), estado: 'TODOS' }
}

/** "Expedientes de 2026", "Expedientes de 2026 · desde 01/03/2026" o "15/01/2026 – 30/10/2026". */
function tituloPeriodo(filtros: ReporteProcesosJuridicoQuery): string {
  const { desde, hasta } = filtros
  const fechas =
    desde && hasta
      ? `${formatFechaGT(desde)} – ${formatFechaGT(hasta)}`
      : desde
        ? `desde ${formatFechaGT(desde)}`
        : hasta
          ? `hasta ${formatFechaGT(hasta)}`
          : ''
  if (!filtros.anio) return fechas
  return fechas ? `Expedientes de ${filtros.anio} · ${fechas}` : `Expedientes de ${filtros.anio}`
}

/** Igual que el nombre que pone el backend: carpeta, rango o los dos. */
function nombreArchivo(filtros: ReporteProcesosJuridicoQuery): string {
  const partes: string[] = []
  if (filtros.anio) partes.push(String(filtros.anio))
  if (filtros.desde || filtros.hasta) partes.push(`${filtros.desde ?? 'inicio'}_${filtros.hasta ?? 'hoy'}`)
  return `procesos-juridicos_${partes.join('_')}.xlsx`
}

function plural(cantidad: number, singular: string, varios: string) {
  return `${cantidad} ${cantidad === 1 ? singular : varios}`
}

/** Reportes de Jurídico: procesos con desgloses, vista previa y Excel. */
export default function ReportesJuridico() {
  const [filtros, setFiltros] = useState<ReporteProcesosJuridicoQuery>(filtrosIniciales)
  const [descargando, setDescargando] = useState(false)
  const { resumen } = useContextoJuridico()
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  // El mismo schema que valida el backend: fechas reales y "Desde" antes de "Hasta".
  const validacion = useMemo(() => reporteProcesosJuridicoQuerySchema.safeParse(filtros), [filtros])
  const filtrosValidos = validacion.success ? validacion.data : null
  const errorFiltros = validacion.success ? null : (validacion.error.issues[0]?.message ?? 'Filtros inválidos')

  const { reporte, cargando, error, cambiarPagina } = useReporteProcesos(filtrosValidos)
  const hayProcesos = (reporte?.totales.procesos ?? 0) > 0
  const tabla = useRef<HTMLElement>(null)

  // Al cambiar de página se sube al inicio de la tabla: la página nueva se lee desde su primera fila.
  function irAPagina(pagina: number) {
    cambiarPagina(pagina)
    const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    tabla.current?.scrollIntoView({ behavior: sinMovimiento ? 'auto' : 'smooth', block: 'start' })
  }

  async function descargar() {
    if (!filtrosValidos) return
    setDescargando(true)
    setErrorDescarga(null)
    try {
      const contenido = await descargarReporteProcesos(filtrosValidos)
      guardarArchivo(contenido, nombreArchivo(filtrosValidos))
    } catch {
      // La respuesta de error llega como Blob, no como JSON: se muestra un mensaje genérico.
      setErrorDescarga('No se pudo generar el Excel. Intente de nuevo.')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4">
      <FiltrosReporteJuridico
        filtros={filtros}
        onCambiar={setFiltros}
        anios={resumen?.aniosExpedientes ?? []}
        onDescargar={() => void descargar()}
        descargando={descargando}
        puedeDescargar={filtrosValidos !== null && hayProcesos && !cargando}
      />

      {errorFiltros && (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{errorFiltros}</p>
      )}
      {(error ?? errorDescarga) && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error ?? errorDescarga}</p>
      )}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {!reporte ? (
          <>
            <DesgloseEsqueleto />
            <DesgloseEsqueleto />
            <DesgloseEsqueleto />
            <DesgloseEsqueleto />
          </>
        ) : (
          <>
            <DesgloseBarras titulo="Estado" conteos={reporte.desgloses.estado} clasesBarra={CLASES_BARRA} etiquetaAncha />
            <DesgloseBarras
              titulo="Forma de finalización"
              conteos={reporte.desgloses.formaFinalizacion}
              clasesBarra={CLASES_BARRA_FORMA}
              etiquetaAncha
            />
            <DesgloseBarras titulo="Categoría de proceso" conteos={reporte.desgloses.categoria} etiquetaAncha />
            {/* Un proceso con abogada y procuradora cuenta para las dos. */}
            <DesgloseBarras titulo="Carga por responsable" conteos={reporte.desgloses.responsable} etiquetaAncha />
          </>
        )}
      </div>

      <section
        ref={tabla}
        className={`scroll-mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${
          cargando && reporte ? 'opacity-60' : ''
        }`}
        aria-busy={cargando}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-gray-900">
            Procesos jurídicos · {tituloPeriodo(filtros)}
          </h2>
          {reporte && (
            <p className="text-[13px] text-gray-500">
              {plural(reporte.totales.procesos, 'proceso', 'procesos')} de{' '}
              {plural(reporte.totales.usuarias, 'usuaria', 'usuarias')} · mismas columnas que el Excel
            </p>
          )}
        </div>
        {!reporte && (
          <div className="space-y-2 px-5 pb-5">
            {[0, 1, 2, 3, 4].map((indice) => (
              <div key={indice} className="h-6 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        )}
        {reporte && !hayProcesos && (
          <div className="p-4">
            <EmptyState
              Icono={FileSpreadsheet}
              titulo="No hay procesos con estos filtros"
              descripcion={
                filtros.anio && !filtros.desde && !filtros.hasta
                  ? 'Prueba con otro año, estado o responsable.'
                  : 'Prueba con otro rango de fechas, estado o responsable.'
              }
            />
          </div>
        )}
        {reporte && hayProcesos && (
          <>
            <TablaReporteJuridico filas={reporte.vistaPrevia} />
            {reporte.totales.procesos > FILAS_POR_PAGINA_REPORTE_JURIDICO && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-[#fcfcfd] px-5 py-3 text-[13px] text-gray-500">
                <span className="tabular-nums">
                  Mostrando {reporte.vistaPrevia[0]?.numero}–{reporte.vistaPrevia.at(-1)?.numero} de{' '}
                  {plural(reporte.totales.procesos, 'proceso', 'procesos')}
                </span>
                <Paginacion
                  etiqueta="Paginación del reporte"
                  pagina={reporte.pagina}
                  pageSize={FILAS_POR_PAGINA_REPORTE_JURIDICO}
                  total={reporte.totales.procesos}
                  onCambiar={irAPagina}
                />
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
