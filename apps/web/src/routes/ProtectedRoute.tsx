import { Navigate, Outlet } from 'react-router-dom'
import CambiarPassword from '../pages/CambiarPassword'
import { ROL_HOME, type Rol } from '../lib/roles'
import { useAuthStore } from '../store/auth.store'

interface ProtectedRouteProps {
  allowedRoles?: Rol[]
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { usuario, isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return <div className="p-8">Cargando…</div>
  }

  if (!isAuthenticated || !usuario) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(usuario.rol)) {
    return <Navigate to={ROL_HOME[usuario.rol]} replace />
  }

  if (usuario.mustChangePassword) {
    return <CambiarPassword />
  }

  return <Outlet />
}
