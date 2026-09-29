import { useEffect, useState } from 'react'
import type { ReportePoblacionBeneficiada, ReportePoblacionQuery } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerReportePoblacion } from '../api/trabajoSocial.api'

/**
 * Vista previa del reporte para los filtros dados; `null` en `filtros` = filtros inválidos, no se
 * pide nada. Al cambiar de filtros se conserva el reporte anterior mientras llega el nuevo, para
 * que la pantalla no parpadee.
 */
export function useReportePoblacion(filtros: ReportePoblacionQuery | null) {
  const [reporte, setReporte] = useState<ReportePoblacionBeneficiada | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const desde = filtros?.desde
  const hasta = filtros?.hasta
  const tipoRegistro = filtros?.tipoRegistro
  const incluirNinos = filtros?.incluirNinos

  useEffect(() => {
    if (!desde || !hasta || !tipoRegistro || incluirNinos === undefined) {
      return
    }
    let cancelado = false
    setCargando(true)
    setError(null)
    obtenerReportePoblacion({ desde, hasta, tipoRegistro, incluirNinos })
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
  }, [desde, hasta, tipoRegistro, incluirNinos])

  return { reporte, cargando, error }
}
