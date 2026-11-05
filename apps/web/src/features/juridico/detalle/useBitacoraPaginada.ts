import { useEffect, useRef, useState } from 'react'
import { BITACORA_POR_PAGINA, type EntradaBitacoraDto, type ProcesoDetalle } from '@akyuam/shared'
import { listarBitacoraPagina } from '../api/juridico.api'

interface PaginaCargada {
  /** Detalle del proceso con el que se pidió: si se refresca, la página se vuelve a pedir. */
  base: ProcesoDetalle
  pagina: number
  entradas: EntradaBitacoraDto[]
  total: number
}

/**
 * Bitácora por páginas fijas de `BITACORA_POR_PAGINA`: cambiar de página reemplaza lo que se ve,
 * la pantalla nunca se alarga. La página 1 llega con el detalle del proceso; las demás se piden.
 *
 * Al refrescarse el detalle se vuelve a pedir la página abierta (un documento adjunto no saca a
 * nadie de donde estaba), salvo que se haya registrado una actuación nueva: esa aparece arriba de
 * la página 1, y ahí se lleva a la persona para que la vea.
 */
export function useBitacoraPaginada(proceso: ProcesoDetalle) {
  const [pagina, setPagina] = useState(1)
  const [cargada, setCargada] = useState<PaginaCargada | null>(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  const actuacionesPrevias = useRef(proceso.totalActuaciones)

  useEffect(() => {
    if (proceso.totalActuaciones > actuacionesPrevias.current) setPagina(1)
    actuacionesPrevias.current = proceso.totalActuaciones
  }, [proceso])

  useEffect(() => {
    if (pagina === 1) return
    let vigente = true
    setError(false)
    listarBitacoraPagina(proceso.id, { pagina })
      .then((datos) => vigente && setCargada({ base: proceso, ...datos }))
      .catch(() => vigente && setError(true))
    return () => {
      vigente = false
    }
  }, [proceso, pagina, intento])

  const lista =
    pagina === 1
      ? { entradas: proceso.bitacora, total: proceso.bitacoraTotal }
      : cargada && cargada.base === proceso && cargada.pagina === pagina
        ? cargada
        : null

  // Si la página dejó de existir (se borraron entradas), se pasa a la última que sí tiene.
  useEffect(() => {
    if (pagina > 1 && lista && lista.entradas.length === 0) {
      setPagina(Math.max(1, Math.ceil(lista.total / BITACORA_POR_PAGINA)))
    }
  }, [pagina, lista])

  // Mientras llega la página nueva se deja la anterior (atenuada) en vez de un hueco que salta.
  const ultimaVista = useRef(lista ?? { entradas: proceso.bitacora, total: proceso.bitacoraTotal })
  if (lista) ultimaVista.current = lista
  const visible = lista ?? ultimaVista.current

  function cambiarPagina(nueva: number) {
    setError(false)
    setPagina(nueva)
  }

  function reintentar() {
    setError(false)
    setIntento((previo) => previo + 1)
  }

  return {
    pagina,
    entradas: visible.entradas,
    total: visible.total,
    cargando: lista === null && !error,
    error,
    cambiarPagina,
    reintentar,
  }
}
