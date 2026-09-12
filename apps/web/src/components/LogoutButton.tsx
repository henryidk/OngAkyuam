import { useState } from 'react'
import { useAuthStore } from '../store/auth.store'

interface LogoutButtonProps {
  /** 'claro' = uso por defecto en headers sobre fondo blanco. 'oscuro' = sidebars/superficies oscuras. */
  variante?: 'claro' | 'oscuro'
}

const ESTILOS_VARIANTE = {
  claro: 'rounded border px-3 py-1 text-sm disabled:opacity-50',
  oscuro:
    'w-full rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-brand-200 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50',
} as const

export default function LogoutButton({ variante = 'claro' }: LogoutButtonProps) {
  const logout = useAuthStore((state) => state.logout)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function handleClick() {
    setIsLoggingOut(true)
    try {
      // auth.store.logout() ya limpia la sesión local en su propio `finally`
      // aunque el POST falle — atrapamos aquí solo para no dejar una promesa
      // rechazada sin manejar, no hay nada más que mostrar al usuario.
      await logout()
    } catch {
      // intencional: ver comentario arriba.
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoggingOut}
      className={ESTILOS_VARIANTE[variante]}
    >
      {isLoggingOut ? 'Cerrando…' : 'Cerrar'}
    </button>
  )
}
