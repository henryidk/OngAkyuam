import { Navigate, Outlet } from 'react-router-dom'
import { ROL_HOME } from '../lib/roles'
import { useAuthStore } from '../store/auth.store'

export default function PublicRoute() {
  const { usuario, isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    // Breve y sin menú (aún no se sabe quién entra): fondo liso en vez de un texto que parpadea.
    return (
      <div role="status" className="min-h-screen bg-gray-50">
        <span className="sr-only">Cargando…</span>
      </div>
    )
  }

  if (isAuthenticated && usuario) {
    return <Navigate to={ROL_HOME[usuario.rol]} replace />
  }

  return <Outlet />
}
