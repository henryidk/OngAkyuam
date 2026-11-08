import { useEffect, useRef, useState } from 'react'
import { registrarGuardiaSalida } from './guardiaSalida'

/**
 * Red de seguridad al salir de un formulario con cambios sin guardar:
 * - Cerrar la pestaña o recargar: el aviso del navegador.
 * - Navegar dentro de la app (menú, migas, "Volver" protegido): primero `antesDeSalir` (si se
 *   pasa); si devuelve `true` se sale sin preguntar, si no, queda `salidaPendiente`
 *   para que la pantalla muestre "¿Descartar los cambios?".
 */
export function useAvisoSalida(hayCambios: boolean, antesDeSalir: () => Promise<boolean> = () => Promise.resolve(false)) {
  const [salidaPendiente, setSalidaPendiente] = useState<(() => void) | null>(null)
  const antesDeSalirRef = useRef(antesDeSalir)
  useEffect(() => {
    antesDeSalirRef.current = antesDeSalir
  })

  useEffect(() => {
    if (!hayCambios) return
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault()
    window.addEventListener('beforeunload', avisar)
    const quitarGuardia = registrarGuardiaSalida((continuar) => {
      void antesDeSalirRef.current().then((listo) => {
        if (listo) continuar()
        else setSalidaPendiente(() => continuar)
      })
    })
    return () => {
      window.removeEventListener('beforeunload', avisar)
      quitarGuardia()
    }
  }, [hayCambios])

  return {
    salidaPendiente: salidaPendiente !== null,
    /** "Descartar": se sale de todos modos. */
    descartar: () => {
      const continuar = salidaPendiente
      setSalidaPendiente(null)
      continuar?.()
    },
    /** "Seguir editando". */
    quedarse: () => setSalidaPendiente(null),
  }
}
