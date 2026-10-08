import { useEffect } from 'react'
import { Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast'
import AdminLayout from './pages/admin/AdminLayout'
import Usuarios from './pages/admin/Usuarios'
import AreaLayout from './pages/area-atencion/AreaLayout'
import JuridicoLayout from './pages/juridico/JuridicoLayout'
import BandejaJuridico from './features/juridico/bandeja/BandejaJuridico'
import InicioJuridico from './features/juridico/inicio/InicioJuridico'
import ListaProcesosJuridico from './features/juridico/procesos/ListaProcesos'
import RegistrarProcesosJuridico, { RedirigirARegistro } from './features/juridico/registro/RegistrarProcesos'
import DetalleProcesoJuridico from './features/juridico/detalle/DetalleProceso'
import PestanaBitacoraJuridico from './features/juridico/detalle/PestanaBitacora'
import PestanaDocumentosJuridico from './features/juridico/documentos/PestanaDocumentos'
import ListaUsuariasJuridico from './features/juridico/usuarias/ListaUsuarias'
import FichaUsuariaJuridico from './features/juridico/usuarias/FichaUsuaria'
import PestanaResumenJuridico from './features/juridico/usuarias/PestanaResumen'
import PestanaProcesosUsuariaJuridico from './features/juridico/usuarias/PestanaProcesos'
import PestanaDatosCasoJuridico from './features/juridico/usuarias/PestanaDatosCaso'
import PestanaDocumentosTsJuridico from './features/juridico/usuarias/PestanaDocumentosTs'
import PestanaReferenciasJuridico from './features/juridico/usuarias/PestanaReferencias'
import ReportesJuridico from './features/juridico/reportes/ReportesJuridico'
import Login from './pages/Login'
import Medica from './pages/Medica'
import MedicaExpediente from './pages/MedicaExpediente'
import Agenda from './features/psicologia/agenda/Agenda'
import BandejaPsicologia from './features/psicologia/bandeja/BandejaPsicologia'
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
import { RUTAS_PSICOLOGIA } from './features/psicologia/rutas'
import TrabajoSocialLayout from './pages/trabajo-social/TrabajoSocialLayout'
import RegistrarUsuaria from './features/registro-usuaria/RegistrarUsuaria'
import ListaUsuariasTs from './features/trabajo-social/usuarias/ListaUsuarias'
import FichaUsuariaTs from './features/trabajo-social/ficha/FichaUsuaria'
import PestanaResumenTs from './features/trabajo-social/ficha/pestanas/PestanaResumen'
import PestanaDatosTs from './features/trabajo-social/ficha/pestanas/PestanaDatos'
import PestanaCasosTs from './features/trabajo-social/ficha/pestanas/PestanaCasos'
import RutaDocumentosTs from './features/trabajo-social/ficha/pestanas/RutaDocumentos'
import RutaAccesosTs from './features/trabajo-social/ficha/pestanas/RutaAccesos'
import PestanaBitacoraTs from './features/trabajo-social/ficha/pestanas/PestanaBitacora'
import BandejaTs from './features/trabajo-social/bandeja/Bandeja'
import ReportesTs from './features/trabajo-social/reportes/Reportes'
import ProtectedRoute from './routes/ProtectedRoute'
import PublicRoute from './routes/PublicRoute'
import { useAuthStore } from './store/auth.store'

/** Redirect de compatibilidad para la ruta vieja `/psicologia/pacientes/:id` (§8.1 del plan). */
function RedirigirAExpediente() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={RUTAS_PSICOLOGIA.expediente(id!)} replace />
}

/**
 * Redirect de compatibilidad para `/psicologia/expedientes/:id/citas/nueva` (§8.1 del plan):
 * agendar dejó de colgar del expediente y ahora vive en la agenda. Se conserva `?reprograma=`
 * porque era la mitad del significado de esa URL vieja.
 */
function RedirigirANuevaCita() {
  const { expedienteId } = useParams<{ expedienteId: string }>()
  const [searchParams] = useSearchParams()
  const citaAReprogramar = searchParams.get('reprograma')
  const destino = citaAReprogramar
    ? RUTAS_PSICOLOGIA.reprogramarCita(citaAReprogramar)
    : RUTAS_PSICOLOGIA.nuevaCita({ expedienteId })
  return <Navigate to={destino} replace />
}

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth)

  useEffect(() => {
    void checkAuth()
  }, [checkAuth])

  return (
    <ToastProvider>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<Login />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['TRABAJO_SOCIAL']} />}>
          <Route path="/trabajo-social" element={<TrabajoSocialLayout />}>
            <Route index element={<BandejaTs />} />
            <Route path="registrar" element={<RegistrarUsuaria />} />
            <Route path="usuarias" element={<ListaUsuariasTs />} />
            <Route path="usuarias/:usuariaId" element={<FichaUsuariaTs />}>
              <Route index element={<PestanaResumenTs />} />
              <Route path="datos" element={<PestanaDatosTs />} />
              <Route path="casos" element={<PestanaCasosTs />} />
              <Route path="documentos" element={<RutaDocumentosTs />} />
              <Route path="accesos" element={<RutaAccesosTs />} />
              <Route path="bitacora" element={<PestanaBitacoraTs />} />
            </Route>
            <Route path="reportes" element={<ReportesTs />} />
            {/* Ruta vieja de la sección "Expediente" (plan §5.1). */}
            <Route path="expediente" element={<Navigate to="/trabajo-social/usuarias" replace />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['JURIDICO']} />}>
          <Route path="/juridico" element={<JuridicoLayout />}>
            <Route index element={<InicioJuridico />} />
            <Route path="atencion" element={<BandejaJuridico />} />
            <Route path="procesos" element={<ListaProcesosJuridico />} />
            {/* Antes que "procesos/:procesoId": "registrar" no es un id. */}
            <Route path="procesos/registrar" element={<RegistrarProcesosJuridico />} />
            <Route path="procesos/:procesoId" element={<DetalleProcesoJuridico />}>
              <Route index element={<PestanaBitacoraJuridico />} />
              <Route path="documentos" element={<PestanaDocumentosJuridico />} />
            </Route>
            {/* La antigua búsqueda de Expedientes ahora es la lista de Usuarias. */}
            <Route path="expedientes" element={<Navigate to="/juridico/usuarias" replace />} />
            <Route path="usuarias" element={<ListaUsuariasJuridico />} />
            <Route path="usuarias/:usuariaId" element={<FichaUsuariaJuridico />}>
              <Route index element={<PestanaResumenJuridico />} />
              <Route path="procesos" element={<PestanaProcesosUsuariaJuridico />} />
              <Route path="datos" element={<PestanaDatosCasoJuridico />} />
              <Route path="documentos" element={<PestanaDocumentosTsJuridico />} />
              <Route path="referencias" element={<PestanaReferenciasJuridico />} />
            </Route>
            <Route path="reportes" element={<ReportesJuridico />} />
            {/* Ruta vieja del espacio de trabajo por expediente. */}
            <Route path=":id/casos" element={<RedirigirARegistro />} />
          </Route>
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['PSICOLOGIA']} />}>
          <Route path="/psicologia" element={<PsicologiaLayout />}>
            <Route index element={<Navigate to={RUTAS_PSICOLOGIA.atencion()} replace />} />
            <Route path="atencion" element={<BandejaPsicologia />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="agenda/nueva-cita" element={<ProgramarCita />} />
            <Route path="expedientes" element={<BuscarExpedientes />} />
            <Route path="expedientes/:expedienteId" element={<ExpedienteUsuaria />}>
              <Route index element={<PestanaResumen />} />
              <Route path="citas" element={<PestanaHistorialCitas />} />
              <Route path="consultas" element={<PestanaConsultas />} />
              <Route path="documentos" element={<PestanaDocumentos />} />
              <Route path="datos" element={<PestanaDatosUsuaria />} />
            </Route>
            <Route path="citas/:citaId" element={<DetalleCita />} />
            <Route path="citas/:citaId/atencion" element={<RegistroConsulta />} />
            <Route path="indicadores" element={<Indicadores />} />
            {/* Redirects de compatibilidad de la reestructura (§8.1 del plan). */}
            <Route path="expedientes/:expedienteId/citas/nueva" element={<RedirigirANuevaCita />} />
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
    </ToastProvider>
  )
}

export default App
