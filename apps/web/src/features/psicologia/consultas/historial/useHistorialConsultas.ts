import { useCallback, useEffect, useState } from 'react'
import {
  buscarHistorialConsultasPsicologiaSchema,
  hoyGT,
  sumarDiasGT,
  type AlcancePsicologia,
  type ClinicaPsicologia,
  type EstadoHistorialConsultasPsicologia,
} from '@akyuam/shared'
import { buscarHistorialConsultas } from '../../api/psicologia.api'
import { usePaginasCursor } from '../../compartido/usePaginasCursor'

/** Al entrar se ven las sesiones del último mes. */
const DIAS_RANGO_INICIAL = 30
/** Espera tras la última tecla antes de buscar: una petición por búsqueda, no por letra. */
const ESPERA_BUSQUEDA_MS = 350

export interface FiltrosHistorialEstado {
  desde: string
  hasta: string
  texto: string
  clinica: ClinicaPsicologia | null
  estado: EstadoHistorialConsultasPsicologia | null
  de: AlcancePsicologia
}

function filtrosIniciales(): FiltrosHistorialEstado {
  const hoy = hoyGT()
  return { desde: sumarDiasGT(hoy, -(DIAS_RANGO_INICIAL - 1)), hasta: hoy, texto: '', clinica: null, estado: null, de: 'MIOS' }
}

function sonIniciales(filtros: FiltrosHistorialEstado): boolean {
  const iniciales = filtrosIniciales()
  return (Object.keys(iniciales) as (keyof FiltrosHistorialEstado)[]).every((clave) => filtros[clave] === iniciales[clave])
}

/**
 * Filtros, búsqueda y paginación del Historial. El texto buscado vive solo en este estado: nunca
 * en la URL ni en el almacenamiento del navegador, y viaja en el cuerpo del POST.
 */
export function useHistorialConsultas() {
  const [filtros, setFiltros] = useState(filtrosIniciales)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    const espera = setTimeout(() => setBusqueda(filtros.texto.trim()), ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(espera)
  }, [filtros.texto])

  const cambiar = useCallback(
    <K extends keyof FiltrosHistorialEstado>(clave: K, valor: FiltrosHistorialEstado[K]) =>
      setFiltros((previos) => ({ ...previos, [clave]: valor })),
    [],
  )
  const limpiar = useCallback(() => {
    setFiltros(filtrosIniciales())
    setBusqueda('')
  }, [])

  const { desde, hasta, clinica, estado, de } = filtros
  // Con el mismo schema que el backend: un rango inválido se explica aquí y no se pide. Las
  // búsquedas de menos de 3 letras el schema las ignora, igual que el servidor.
  const validacion = buscarHistorialConsultasPsicologiaSchema.safeParse({ desde, hasta, q: busqueda })
  const errorRango = validacion.success ? null : (validacion.error.issues[0]?.message ?? 'Revisa las fechas.')
  const q = validacion.success ? validacion.data.q : undefined

  const rangoValido = errorRango === null
  const cargar = useCallback(
    (cursor?: string) =>
      rangoValido
        ? buscarHistorialConsultas({ desde, hasta, q, clinica: clinica ?? undefined, estado: estado ?? undefined, de, cursor })
        : Promise.resolve({ items: [], siguienteCursor: null }),
    [desde, hasta, q, clinica, estado, de, rangoValido],
  )
  const paginas = usePaginasCursor(`${desde}|${hasta}|${q ?? ''}|${clinica}|${estado}|${de}`, cargar)

  return {
    filtros,
    cambiar,
    limpiar,
    hayFiltros: !sonIniciales(filtros),
    errorRango,
    conBusqueda: q !== undefined,
    ...paginas,
  }
}
