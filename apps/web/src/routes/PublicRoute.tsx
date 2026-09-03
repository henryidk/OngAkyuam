import { Navigate, Outlet } from 'react-router-dom'
import { ROL_HOME } from '../lib/roles'
import { useAuthStore } from '../store/auth.store'

export default function PublicRoute() {
  const { usuario, isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return <div className="p-8">Cargando…</div>
  }

  if (isAuthenticated && usuario) {
    return <Navigate to={ROL_HOME[usuario.rol]} replace />
  }

  return <Outlet />
}
