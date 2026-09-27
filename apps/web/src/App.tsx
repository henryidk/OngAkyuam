import { useEffect } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import AdminLayout from './pages/admin/AdminLayout'
import Usuarios from './pages/admin/Usuarios'
import AreaLayout from './pages/area-atencion/AreaLayout'
import Juridica from './pages/Juridica'
import JuridicaExpediente from './pages/JuridicaExpediente'
import Login from './pages/Login'
import Medica from './pages/Medica'
import MedicaExpediente from './pages/MedicaExpediente'
import AreaAtencion from './features/psicologia/atencion/AreaAtencion'
import Agenda from './features/psicologia/agenda/Agenda'
import BuscarExpedientes from './features/psicologia/expedientes/BuscarExpedientes'
import ExpedienteUsuaria from './features/psicologia/expedientes/ExpedienteUsuaria'
import PestanaResumen from './features/psicologia/expedientes/PestanaResumen'
import PestanaHistorialCitas from './features/psicologia/expedientes/PestanaHistorialCitas'
import PestanaConsultas from './features/psicologia/expedientes/PestanaConsultas'
import PestanaDocumentos from './features/psicologia/expedientes/PestanaDocumentos'
import PestanaDatosUsuaria from './features/psicologia/expedientes/PestanaDatosUsuaria'
import ProgramarCita from './features/psicologia/citas/ProgramarCita'
import DetalleCita from './features/psicologia/citas/DetalleCita'
import RegistroConsulta from './features/psicologia/citas/RegistroConsulta'
import Indicadores from './features/psicologia/indicadores/Indicadores'
import PsicologiaLayout from './pages/psicologia/PsicologiaLayout'
import Expediente from './pages/trabajo-social/Expediente'
import Inicio from './pages/trabajo-social/Inicio'
import TrabajoSocialLayout from './pages/trabajo-social/TrabajoSocialLayout'
import RegistrarUsuaria from './features/registro-usuaria/RegistrarUsuaria'
import ProtectedRoute from './routes/ProtectedRoute'
import PublicRoute from './routes/PublicRoute'
import { useAuthStore } from './store/auth.store'

/** Redirect de compatibilidad para la ruta vieja `/psicologia/pacientes/:id` (§8.1 del plan). */
function RedirigirAExpediente() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/psicologia/expedientes/${id}`} replace />
}

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
          <Route index element={<AreaAtencion />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="expedientes" element={<BuscarExpedientes />} />
          <Route path="expedientes/:expedienteId" element={<ExpedienteUsuaria />}>
            <Route index element={<PestanaResumen />} />
            <Route path="citas" element={<PestanaHistorialCitas />} />
            <Route path="consultas" element={<PestanaConsultas />} />
            <Route path="documentos" element={<PestanaDocumentos />} />
            <Route path="datos" element={<PestanaDatosUsuaria />} />
          </Route>
          <Route path="expedientes/:expedienteId/citas/nueva" element={<ProgramarCita />} />
          <Route path="citas/:citaId" element={<DetalleCita />} />
          <Route path="citas/:citaId/atencion" element={<RegistroConsulta />} />
          <Route path="indicadores" element={<Indicadores />} />
          <Route path="pacientes/:id" element={<RedirigirAExpediente />} />
          <Route path="reporte" element={<Navigate to="/psicologia/indicadores" replace />} />
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
