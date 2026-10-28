import { useCallback, useEffect, useState } from 'react'
import { buscarHistorialConsultasMedicaSchema, hoyGT, sumarDiasGT } from '@akyuam/shared'
import { usePaginasCursor } from '../../../psicologia/compartido/usePaginasCursor'
import { buscarHistorialConsultas } from '../../api/medica.api'
import { useRecargaNovedades } from '../../compartido/useRecargaNovedades'

/** Al entrar se ven las consultas del último mes. */
const DIAS_RANGO_INICIAL = 30
/** Espera tras la última tecla antes de buscar: una petición por búsqueda, no por letra. */
const ESPERA_BUSQUEDA_MS = 350

/**
 * Filtros, búsqueda y paginación del Historial. El texto buscado vive solo en este estado: nunca
 * en la URL ni en el almacenamiento del navegador, y viaja en el cuerpo del POST (§10).
 */
export function useHistorialConsultas() {
  const [desde, setDesde] = useState(() => sumarDiasGT(hoyGT(), -(DIAS_RANGO_INICIAL - 1)))
  const [hasta, setHasta] = useState(() => hoyGT())
  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    const espera = setTimeout(() => setBusqueda(texto.trim()), ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(espera)
  }, [texto])

  // Con el mismo schema que el backend: un rango inválido se explica aquí y no se pide.
  const validacion = buscarHistorialConsultasMedicaSchema.safeParse({ desde, hasta, q: busqueda })
  const errorRango = validacion.success ? null : (validacion.error.issues[0]?.message ?? 'Revisa las fechas.')

  const rangoValido = errorRango === null
  const cargar = useCallback(
    (cursor?: string) =>
      rangoValido
        ? buscarHistorialConsultas({ desde, hasta, q: busqueda || undefined, cursor })
        : Promise.resolve({ items: [], siguienteCursor: null }),
    [desde, hasta, busqueda, rangoValido],
  )
  const paginas = usePaginasCursor(`${desde}:${hasta}:${busqueda}`, cargar)
  useRecargaNovedades(paginas.recargar)

  return {
    filtros: { desde, hasta, texto, setDesde, setHasta, setTexto },
    errorRango,
    conBusqueda: busqueda !== '',
    ...paginas,
  }
}
