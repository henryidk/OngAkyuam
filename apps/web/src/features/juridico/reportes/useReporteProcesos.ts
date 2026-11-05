import { useEffect, useState } from 'react'
import {
  FILAS_POR_PAGINA_REPORTE_JURIDICO,
  type ReporteProcesosJuridico,
  type ReporteProcesosJuridicoQuery,
} from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerReporteProcesos } from '../api/juridico.api'

/**
 * Vista previa del reporte para los filtros dados, una página de la tabla a la vez; `null` en
 * `filtros` = filtros inválidos, no se pide nada. Al cambiar de filtros o de página se conserva el
 * reporte anterior mientras llega el nuevo, para que la pantalla no parpadee.
 *
 * La página va atada a los filtros con que se eligió: cambiar un filtro vuelve a la página 1 sin
 * pedir dos veces (una con la página vieja y otra con la 1).
 */
export function useReporteProcesos(filtros: ReporteProcesosJuridicoQuery | null) {
  const [reporte, setReporte] = useState<ReporteProcesosJuridico | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eleccion, setEleccion] = useState({ clave: '', pagina: 1 })

  const anio = filtros?.anio
  const desde = filtros?.desde
  const hasta = filtros?.hasta
  const estado = filtros?.estado
  const mios = filtros?.mios
  const tipo = filtros?.tipo

  const clave = JSON.stringify([anio, desde, hasta, estado, mios, tipo])
  const pagina = eleccion.clave === clave ? eleccion.pagina : 1

  useEffect(() => {
    if (!estado) {
      return
    }
    let cancelado = false
    setCargando(true)
    setError(null)
    // Con carpeta, las fechas (si las hay) acotan sus procesos: se envían las dos cosas.
    obtenerReporteProcesos({ anio, desde, hasta, estado, mios, tipo }, pagina)
      .then((datos) => {
        if (cancelado) return
        // La página dejó de existir (otra persona cerró o reasignó procesos): a la última que sí hay.
        if (datos.vistaPrevia.length === 0 && datos.totales.procesos > 0 && pagina > 1) {
          setEleccion({ clave, pagina: Math.ceil(datos.totales.procesos / FILAS_POR_PAGINA_REPORTE_JURIDICO) })
          return
        }
        setReporte(datos)
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(extraerMensajeError(err))
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [anio, desde, hasta, estado, mios, tipo, pagina, clave])

  function cambiarPagina(nueva: number) {
    setEleccion({ clave, pagina: nueva })
  }

  return { reporte, cargando, error, cambiarPagina }
}
