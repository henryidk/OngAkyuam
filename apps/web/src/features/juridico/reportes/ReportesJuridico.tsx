import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import {
  formatFechaGT,
  hoyGT,
  reporteProcesosJuridicoQuerySchema,
  type PersonalDto,
  type ReporteProcesosJuridicoQuery,
} from '@akyuam/shared'
import DesgloseBarras, { DesgloseEsqueleto } from '../../../components/reportes/DesgloseBarras'
import EmptyState from '../../../components/ui/EmptyState'
import { guardarArchivo } from '../../../lib/archivos'
import { descargarReporteProcesos, listarPersonalJuridico } from '../api/juridico.api'
import { CLASES_BARRA, CLASES_BARRA_FORMA } from '../compartido/colores'
import FiltrosReporteJuridico from './FiltrosReporteJuridico'
import TablaReporteJuridico from './TablaReporteJuridico'
import { useReporteProcesos } from './useReporteProcesos'

/** Por defecto, del 1 de enero del año en curso hasta hoy (hora de Guatemala). */
function filtrosIniciales(): ReporteProcesosJuridicoQuery {
  const hoy = hoyGT()
  return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy, estado: 'TODOS' }
}

function plural(cantidad: number, singular: string, varios: string) {
  return `${cantidad} ${cantidad === 1 ? singular : varios}`
}

/** Reportes de Jurídico: procesos con desgloses, vista previa y Excel. */
export default function ReportesJuridico() {
  const [filtros, setFiltros] = useState<ReporteProcesosJuridicoQuery>(filtrosIniciales)
  const [abogadas, setAbogadas] = useState<PersonalDto[]>([])
  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  // Activas primero; si la lista falla, el filtro queda en "Todas" y el reporte sigue funcionando.
  useEffect(() => {
    let cancelado = false
    listarPersonalJuridico()
      .then((personal) => {
        if (cancelado) return
        const lista = personal.filter((persona) => persona.tipo === 'ABOGADA')
        lista.sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre, 'es'))
        setAbogadas(lista)
      })
      .catch(() => undefined)
    return () => {
      cancelado = true
    }
  }, [])

  // El mismo schema que valida el backend: fechas reales y "Desde" antes de "Hasta".
  const validacion = useMemo(() => reporteProcesosJuridicoQuerySchema.safeParse(filtros), [filtros])
  const filtrosValidos = validacion.success ? validacion.data : null
  const errorFiltros = validacion.success ? null : (validacion.error.issues[0]?.message ?? 'Filtros inválidos')

  const { reporte, cargando, error } = useReporteProcesos(filtrosValidos)
  const hayProcesos = (reporte?.totales.procesos ?? 0) > 0

  async function descargar() {
    if (!filtrosValidos) return
    setDescargando(true)
    setErrorDescarga(null)
    try {
      const contenido = await descargarReporteProcesos(filtrosValidos)
      guardarArchivo(contenido, `procesos-juridicos_${filtrosValidos.desde}_${filtrosValidos.hasta}.xlsx`)
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
        abogadas={abogadas}
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
          </>
        )}
      </div>

      <section
        className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${
          cargando && reporte ? 'opacity-60' : ''
        }`}
        aria-busy={cargando}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-gray-900">
            Procesos jurídicos · {formatFechaGT(filtros.desde || hoyGT())} – {formatFechaGT(filtros.hasta || hoyGT())}
          </h2>
          {reporte && (
            <p className="text-[13px] text-gray-500">
              {plural(reporte.totales.procesos, 'proceso', 'procesos')} de{' '}
              {plural(reporte.totales.usuarias, 'usuaria', 'usuarias')} · vista previa de las columnas del Excel
              {reporte.totales.procesos > reporte.vistaPrevia.length &&
                ` (primeras ${reporte.vistaPrevia.length} filas)`}
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
              descripcion="Prueba con otro rango de fechas, estado o abogada."
            />
          </div>
        )}
        {reporte && hayProcesos && <TablaReporteJuridico filas={reporte.vistaPrevia} />}
      </section>
    </div>
  )
}
