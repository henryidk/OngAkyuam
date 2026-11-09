import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { hoyGT, type ProcesoParaAgendarDto } from '@akyuam/shared'
import PestanasVista from '../../../components/PestanasVista'
import { useTituloPagina, TituloPrincipal } from '../../../components/TituloPagina'
import Button from '../../../components/ui/Button'
import { useToast } from '../../../components/ui/Toast'
import { extraerMensajeError } from '../../../lib/errors'
import { listarProcesosParaAgendar } from '../api/psicologia.api'
import ModalProgramarCita from '../citas/ModalProgramarCita'
import { useContextoPsicologia } from '../compartido/contexto'
import { RUTAS_PSICOLOGIA, type VistaConsultasPsicologia } from '../rutas'
import HistorialConsultas from './historial/HistorialConsultas'
import ListaPorRegistrar from './porRegistrar/ListaPorRegistrar'

/**
 * Consultas: lo que ya pasó y falta cerrar (Por registrar), la sesión sin cita y el historial de
 * lo registrado, igual que en Médica. Planificar es de la Agenda. La pestaña vive en la URL
 * (`?vista=historial`) para que recargar o volver atrás caiga en la misma.
 *
 * La sesión sin cita se elige por proceso y se registra con la fecha y hora del momento.
 */
export default function PaginaConsultas() {
  useTituloPagina({ titulo: 'Consultas' })
  const [params, setParams] = useSearchParams()
  const { resumen } = useContextoPsicologia()
  const vista: VistaConsultasPsicologia = params.get('vista') === 'historial' ? 'historial' : 'por-registrar'
  const porRegistrar = resumen?.sesionesPorRegistrar ?? 0
  const navigate = useNavigate()
  const { mostrar } = useToast()
  const [procesosSinCita, setProcesosSinCita] = useState<ProcesoParaAgendarDto[] | null>(null)
  const [preparando, setPreparando] = useState(false)

  async function abrirSinCita() {
    setPreparando(true)
    try {
      setProcesosSinCita(await listarProcesosParaAgendar())
    } catch (err) {
      mostrar(extraerMensajeError(err), 'error')
    } finally {
      setPreparando(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <TituloPrincipal className="text-2xl font-semibold tracking-tight text-gray-900">
            {vista === 'historial' ? 'Historial de sesiones' : 'Sesiones por registrar'}
          </TituloPrincipal>
          <p className="text-sm text-gray-500">
            {vista === 'historial'
              ? 'Abre una sesión para ver sus notas. Cada apertura queda registrada.'
              : 'Registra la sesión o la inasistencia de cada cita que ya empezó. Las que aún no empiezan están en la Agenda.'}
          </p>
        </div>
        <Button variante="secondary" tamano="md" onClick={() => void abrirSinCita()} cargando={preparando}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Sesión sin cita
        </Button>
      </div>

      <PestanasVista
        etiqueta="Secciones de consultas"
        pestanas={[
          { vista: 'por-registrar', etiqueta: 'Por registrar', conteo: porRegistrar },
          { vista: 'historial', etiqueta: 'Historial' },
        ]}
        activa={vista}
        onCambiar={(nueva: VistaConsultasPsicologia) => setParams(nueva === 'historial' ? { vista: 'historial' } : {})}
      >
        {vista === 'historial' ? <HistorialConsultas /> : <ListaPorRegistrar />}
      </PestanasVista>

      {procesosSinCita && (
        <ModalProgramarCita
          destino={{ tipo: 'PROCESO', procesos: procesosSinCita, procesoId: null, sinCita: true }}
          fechaInicial={hoyGT()}
          onCerrar={() => setProcesosSinCita(null)}
          onGuardada={() => setProcesosSinCita(null)}
          onProcesoElegido={(procesoId) => navigate(RUTAS_PSICOLOGIA.sesionSinCita(procesoId, 'consultas'))}
        />
      )}
    </div>
  )
}
