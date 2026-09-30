import { useMemo, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import {
  formatFechaGT,
  hoyGT,
  mesActualGT,
  reportePoblacionQuerySchema,
  type ReportePoblacionQuery,
} from '@akyuam/shared'
import EmptyState from '../../../components/ui/EmptyState'
import { descargarReportePoblacion } from '../api/trabajoSocial.api'
import DesgloseBarras, { DesgloseEsqueleto } from './DesgloseBarras'
import FiltrosReporte from './FiltrosReporte'
import TablaVistaPrevia from './TablaVistaPrevia'
import { useReportePoblacion } from './useReportePoblacion'

/** Por defecto, el mes en curso hasta hoy (hora de Guatemala). */
function filtrosIniciales(): ReportePoblacionQuery {
  const { anio, mes } = mesActualGT()
  return {
    desde: `${anio}-${String(mes).padStart(2, '0')}-01`,
    hasta: hoyGT(),
    tipoRegistro: 'TODOS',
    incluirNinos: true,
  }
}

function plural(cantidad: number, singular: string, varios: string) {
  return `${cantidad} ${cantidad === 1 ? singular : varios}`
}

/** Guarda el archivo que ya está en memoria; el enlace temporal se libera enseguida. */
function guardarArchivo(contenido: Blob, nombre: string) {
  const url = URL.createObjectURL(contenido)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Reportes de Trabajo Social (plan §12.9): población beneficiada con vista previa y Excel. */
export default function Reportes() {
  const [filtros, setFiltros] = useState<ReportePoblacionQuery>(filtrosIniciales)
  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  // El mismo schema que valida el backend: fechas reales y "Desde" antes de "Hasta".
  const validacion = useMemo(() => reportePoblacionQuerySchema.safeParse(filtros), [filtros])
  const filtrosValidos = validacion.success ? validacion.data : null
  const errorFiltros = validacion.success ? null : (validacion.error.issues[0]?.message ?? 'Filtros inválidos')

  const { reporte, cargando, error } = useReportePoblacion(filtrosValidos)
  const hayPersonas = (reporte?.totales.personas ?? 0) > 0

  async function descargar() {
    if (!filtrosValidos) return
    setDescargando(true)
    setErrorDescarga(null)
    try {
      const contenido = await descargarReportePoblacion(filtrosValidos)
      guardarArchivo(contenido, `poblacion-beneficiada_${filtrosValidos.desde}_${filtrosValidos.hasta}.xlsx`)
    } catch {
      // La respuesta de error llega como Blob, no como JSON: se muestra un mensaje genérico.
      setErrorDescarga('No se pudo generar el Excel. Intente de nuevo.')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-4">
      <p className="text-sm text-gray-500">
        Población beneficiada: usuarias atendidas y sus hijas e hijos, con las mismas columnas del Excel.
      </p>

      <FiltrosReporte
        filtros={filtros}
        onCambiar={setFiltros}
        onDescargar={() => void descargar()}
        descargando={descargando}
        puedeDescargar={filtrosValidos !== null && hayPersonas && !cargando}
      />

      {errorFiltros && (
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{errorFiltros}</p>
      )}
      {(error ?? errorDescarga) && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error ?? errorDescarga}</p>
      )}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {!reporte ? (
          <>
            <DesgloseEsqueleto />
            <DesgloseEsqueleto />
            <DesgloseEsqueleto />
          </>
        ) : (
          <>
            <DesgloseBarras titulo="Rango de edad" conteos={reporte.desgloses.rangoEdad} />
            <DesgloseBarras titulo="Grupo étnico" conteos={reporte.desgloses.grupoEtnico} />
            <DesgloseBarras titulo="Tipología 22-2008 (usuarias)" conteos={reporte.desgloses.tipologia} />
          </>
        )}
      </div>

      <section
        className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${
          cargando && reporte ? 'opacity-60' : ''
        }`}
        aria-busy={cargando}
      >
        <div className="px-5 py-4">
          <h2 className="text-[15px] font-semibold text-gray-900">
            Población beneficiada · {formatFechaGT(filtros.desde || hoyGT())} – {formatFechaGT(filtros.hasta || hoyGT())}
          </h2>
          {reporte && (
            <p className="mt-0.5 text-[13px] text-gray-500">
              {plural(reporte.totales.personas, 'persona', 'personas')}:{' '}
              {plural(reporte.totales.usuarias, 'usuaria', 'usuarias')} +{' '}
              {plural(reporte.totales.ninos, 'hija/hijo', 'hijas/hijos')} · vista previa de las columnas del Excel
              {reporte.totales.personas > reporte.vistaPrevia.length &&
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
        {reporte && !hayPersonas && (
          <div className="p-4">
            <EmptyState
              Icono={FileSpreadsheet}
              titulo="No hay registros en este periodo"
              descripcion="Prueba con otro rango de fechas o tipo de registro."
            />
          </div>
        )}
        {reporte && hayPersonas && <TablaVistaPrevia filas={reporte.vistaPrevia} />}
      </section>
    </div>
  )
}
