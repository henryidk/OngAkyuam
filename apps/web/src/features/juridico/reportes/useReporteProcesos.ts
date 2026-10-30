import { useEffect, useState } from 'react'
import type { ReporteProcesosJuridico, ReporteProcesosJuridicoQuery } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerReporteProcesos } from '../api/juridico.api'

/**
 * Vista previa del reporte para los filtros dados; `null` en `filtros` = filtros inválidos, no se
 * pide nada. Al cambiar de filtros se conserva el reporte anterior mientras llega el nuevo, para
 * que la pantalla no parpadee.
 */
export function useReporteProcesos(filtros: ReporteProcesosJuridicoQuery | null) {
  const [reporte, setReporte] = useState<ReporteProcesosJuridico | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cartera = filtros?.cartera
  const desde = filtros?.desde
  const hasta = filtros?.hasta
  const estado = filtros?.estado
  const responsableId = filtros?.responsableId
  const tipo = filtros?.tipo

  useEffect(() => {
    if (!cartera || !estado) {
      return
    }
    let cancelado = false
    setCargando(true)
    setError(null)
    obtenerReporteProcesos({ cartera, desde, hasta, estado, responsableId, tipo })
      .then((datos) => {
        if (!cancelado) setReporte(datos)
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
  }, [cartera, desde, hasta, estado, responsableId, tipo])

  return { reporte, cargando, error }
}
