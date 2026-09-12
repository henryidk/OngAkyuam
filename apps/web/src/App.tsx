import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Administracion from './pages/admin/Administracion'
import Juridica from './pages/Juridica'
import JuridicaExpediente from './pages/JuridicaExpediente'
import Login from './pages/Login'
import Medica from './pages/Medica'
import MedicaExpediente from './pages/MedicaExpediente'
import Psicologica from './pages/Psicologica'
import PsicologicaExpediente from './pages/PsicologicaExpediente'
import Expediente from './pages/trabajo-social/Expediente'
import Inicio from './pages/trabajo-social/Inicio'
import TrabajoSocialLayout from './pages/trabajo-social/TrabajoSocialLayout'
import RegistrarUsuaria from './features/registro-usuaria/RegistrarUsuaria'
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
        <Route path="/trabajo-social" element={<TrabajoSocialLayout />}>
          <Route index element={<Inicio />} />
          <Route path="registrar" element={<RegistrarUsuaria />} />
          <Route path="expediente" element={<Expediente />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['JURIDICO']} />}>
        <Route path="/juridico" element={<Juridica />} />
        <Route path="/juridico/:id" element={<JuridicaExpediente />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['PSICOLOGIA']} />}>
        <Route path="/psicologia" element={<Psicologica />} />
        <Route path="/psicologia/:id" element={<PsicologicaExpediente />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['MEDICA']} />}>
        <Route path="/medica" element={<Medica />} />
        <Route path="/medica/:id" element={<MedicaExpediente />} />
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
