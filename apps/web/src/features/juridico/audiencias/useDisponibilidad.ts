import { useEffect, useState } from 'react'
import type { AudienciaOcupadaDto } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerDisponibilidad } from '../api/audiencias.api'

const FECHA_COMPLETA = /^\d{4}-\d{2}-\d{2}$/

interface Disponibilidad {
  /** `null` mientras no hay responsable y fecha, o mientras carga. */
  ocupadas: AudienciaOcupadaDto[] | null
  cargando: boolean
  error: string | null
}

/**
 * Lo que la responsable ya tiene ese día. Es solo un aviso para prevenir el choque: el backend
 * vuelve a validar la hora al guardar.
 */
export function useDisponibilidad(responsableId: string, fecha: string): Disponibilidad {
  const [estado, setEstado] = useState<Disponibilidad & { clave: string }>({
    clave: '',
    ocupadas: null,
    cargando: false,
    error: null,
  })
  const clave = responsableId && FECHA_COMPLETA.test(fecha) ? `${responsableId}|${fecha}` : ''

  useEffect(() => {
    if (!clave) return
    let vigente = true
    obtenerDisponibilidad({ responsableId, fecha })
      .then((dia) => {
        if (vigente) setEstado({ clave, ocupadas: dia.audiencias, cargando: false, error: null })
      })
      .catch((err: unknown) => {
        if (vigente) setEstado({ clave, ocupadas: null, cargando: false, error: extraerMensajeError(err) })
      })
    return () => {
      vigente = false
    }
  }, [clave, responsableId, fecha])

  // Mientras no llega la respuesta de esta combinación se está cargando; la de la anterior no se
  // muestra como si fuera la actual.
  if (!clave || estado.clave !== clave) return { ocupadas: null, cargando: Boolean(clave), error: null }
  return estado
}
