import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './pages/admin/AdminLayout'
import Usuarios from './pages/admin/Usuarios'
import AreaLayout from './pages/area-atencion/AreaLayout'
import Juridica from './pages/Juridica'
import JuridicaExpediente from './pages/JuridicaExpediente'
import Login from './pages/Login'
import Medica from './pages/Medica'
import MedicaExpediente from './pages/MedicaExpediente'
import AgendaPsicologia from './features/psicologia/AgendaPsicologia'
import ReportePsicologia from './features/psicologia/ReportePsicologia'
import PsicologiaLayout from './pages/psicologia/PsicologiaLayout'
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
        <Route path="/juridico" element={<AreaLayout subtitulo="Jurídica" basePath="/juridico" />}>
          <Route index element={<Juridica />} />
          <Route path=":id/casos" element={<JuridicaExpediente />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['PSICOLOGIA']} />}>
        <Route path="/psicologia" element={<PsicologiaLayout />}>
          <Route index element={<Psicologica />} />
          <Route path="pacientes/:id" element={<PsicologicaExpediente />} />
          <Route path="agenda" element={<AgendaPsicologia />} />
          <Route path="reporte" element={<ReportePsicologia />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['MEDICA']} />}>
        <Route path="/medica" element={<AreaLayout subtitulo="Médica" basePath="/medica" />}>
          <Route index element={<Medica />} />
          <Route path=":id" element={<MedicaExpediente />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['ADMINISTRACION']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="usuarios" replace />} />
          <Route path="usuarios" element={<Usuarios />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
