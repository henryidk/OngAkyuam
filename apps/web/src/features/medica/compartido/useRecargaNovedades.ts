import { useEffect, useRef } from 'react'
import { useContextoMedica } from './contexto'

/**
 * Vuelve a pedir los datos de la pantalla cuando el socket avisa de un cambio, sin desmontar lo
 * que ya se ve. La primera versión es la de la carga inicial: no se pide dos veces al entrar.
 */
export function useRecargaNovedades(recargar: () => unknown) {
  const { versionNovedades } = useContextoMedica()
  const versionVista = useRef(versionNovedades)
  const recargarActual = useRef(recargar)
  useEffect(() => {
    recargarActual.current = recargar
  }, [recargar])

  useEffect(() => {
    if (versionVista.current === versionNovedades) return
    versionVista.current = versionNovedades
    void recargarActual.current()
  }, [versionNovedades])
}
