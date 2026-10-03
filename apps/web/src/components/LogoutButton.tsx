import { useState } from 'react'
import { hayGuardiaSalida, pedirConfirmacionSalida } from '../lib/guardiaSalida'
import { useAuthStore } from '../store/auth.store'
import ConfirmModal from './ui/ConfirmModal'

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
  const [confirmando, setConfirmando] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function cerrarSesion() {
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
      setConfirmando(false)
    }
  }

  function alPulsar() {
    // Con cambios sin guardar, "¿Descartar los cambios?" ya es la confirmación: no se encadenan
    // dos modales seguidos.
    if (hayGuardiaSalida()) {
      pedirConfirmacionSalida(() => void cerrarSesion())
    } else {
      setConfirmando(true)
    }
  }

  return (
    <>
      <button type="button" onClick={alPulsar} disabled={isLoggingOut} className={ESTILOS_VARIANTE[variante]}>
        {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </button>
      <ConfirmModal
        abierto={confirmando}
        titulo="¿Cerrar sesión?"
        descripcion="Para volver a entrar necesitarás tu usuario y contraseña."
        confirmarLabel="Cerrar sesión"
        cancelarLabel="Seguir aquí"
        cargando={isLoggingOut}
        onConfirmar={() => void cerrarSesion()}
        onCancelar={() => setConfirmando(false)}
      />
    </>
  )
}
