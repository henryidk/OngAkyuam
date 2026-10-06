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

  const desde = filtros?.desde
  const hasta = filtros?.hasta
  const estado = filtros?.estado
  const abogadaId = filtros?.abogadaId

  useEffect(() => {
    if (!desde || !hasta || !estado) {
      return
    }
    let cancelado = false
    setCargando(true)
    setError(null)
    obtenerReporteProcesos({ desde, hasta, estado, abogadaId })
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
  }, [desde, hasta, estado, abogadaId])

  return { reporte, cargando, error }
}
