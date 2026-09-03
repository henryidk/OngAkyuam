import { useState } from 'react'
import { useAuthStore } from '../store/auth.store'

export default function LogoutButton() {
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
      className="rounded border px-3 py-1 text-sm disabled:opacity-50"
    >
      {isLoggingOut ? 'Cerrando…' : 'Cerrar'}
    </button>
  )
}
