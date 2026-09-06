import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Administracion from './pages/admin/Administracion'
import Juridica from './pages/Juridica'
import Login from './pages/Login'
import Medica from './pages/Medica'
import Psicologica from './pages/Psicologica'
import TrabajoSocial from './pages/TrabajoSocial'
import TrabajoSocialRegistros from './pages/TrabajoSocial/Registros'
import TrabajoSocialReportes from './pages/TrabajoSocial/Reportes'
import TrabajoSocialGestion from './pages/TrabajoSocial/Gestion'
import Ajustes from './pages/Ajustes'
import ProtectedRoute from './routes/ProtectedRoute'
import PublicRoute from './routes/PublicRoute'
import { useAuthStore } from './store/auth.store'

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth)

  useEffect(() => {
    void checkAuth()
  }, [checkAuth])

  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['TRABAJO_SOCIAL']} />}>
        <Route path="/trabajo-social" element={<TrabajoSocial />} />
        <Route path="/trabajo-social/registros" element={<TrabajoSocialRegistros />} />
        <Route path="/trabajo-social/expedientes/:id" element={<TrabajoSocialGestion />} />
        <Route path="/trabajo-social/reportes" element={<TrabajoSocialReportes />} />
        <Route path="/trabajo-social/ajustes" element={<Ajustes />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['JURIDICO']} />}>
        <Route path="/juridico" element={<Juridica />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['PSICOLOGIA']} />}>
        <Route path="/psicologia" element={<Psicologica />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['MEDICA']} />}>
        <Route path="/medica" element={<Medica />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['ADMINISTRACION']} />}>
        <Route path="/admin" element={<Administracion />} />
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
