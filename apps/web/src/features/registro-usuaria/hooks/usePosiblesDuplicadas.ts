import { useState } from 'react'
import type { UsuariaResumenBusqueda } from '@akyuam/shared'
import { buscarUsuariasPorNombre } from '../../trabajo-social/api/trabajoSocial.api'

interface IdentidadCapturada {
  nombres: string
  apellidos: string
  dpi?: string
  fechaNacimiento: string
}

interface Revision {
  /** Identidad con la que se buscó: si cambia, el aviso anterior ya no aplica y se vuelve a buscar. */
  clave: string
  coincidencias: UsuariaResumenBusqueda[]
}

function claveDe(identidad: IdentidadCapturada): string {
  return [identidad.nombres, identidad.apellidos, identidad.fechaNacimiento]
    .map((valor) => valor.trim().toLowerCase())
    .join('|')
}

/**
 * Segunda red contra duplicados, solo cuando no hay DPI (con DPI, el índice único del backend ya
 * lo impide): busca usuarias de nombre parecido y se queda con las que nacieron el mismo día.
 */
export function usePosiblesDuplicadas() {
  const [revision, setRevision] = useState<Revision | null>(null)

  /** `true` si hay un aviso que quien registra todavía no ha visto para esta identidad. */
  async function hayAvisoNuevo(identidad: IdentidadCapturada): Promise<boolean> {
    if (identidad.dpi?.trim()) {
      setRevision(null)
      return false
    }
    const clave = claveDe(identidad)
    if (revision?.clave === clave) {
      return false
    }

    let coincidencias: UsuariaResumenBusqueda[]
    try {
      const parecidas = await buscarUsuariasPorNombre(`${identidad.nombres} ${identidad.apellidos}`.trim())
      coincidencias = parecidas.filter((usuaria) => usuaria.fechaNacimiento === identidad.fechaNacimiento)
    } catch {
      // Es solo un aviso: si la búsqueda falla, no se detiene el registro.
      return false
    }
    setRevision({ clave, coincidencias })
    return coincidencias.length > 0
  }

  return { posiblesDuplicadas: revision?.coincidencias ?? [], hayAvisoNuevo }
}
