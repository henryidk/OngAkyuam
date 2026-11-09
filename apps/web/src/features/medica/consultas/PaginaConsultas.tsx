import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import PestanasVista from '../../../components/PestanasVista'
import { useTituloPagina } from '../../../components/TituloPagina'
import { useContextoMedica } from '../compartido/contexto'
import EncabezadoPagina from '../compartido/EncabezadoPagina'
import type { VistaConsultas } from '../rutas'
import HistorialConsultas from './historial/HistorialConsultas'
import ModalConsultaSinCita from './ModalConsultaSinCita'
import ListaPorRegistrar from './porRegistrar/ListaPorRegistrar'

/**
 * Consultas: lo que ya pasó y falta cerrar (Por registrar), la consulta sin cita y el historial
 * de lo registrado. Planificar (programar, reprogramar, sin próxima consulta) es de la Agenda. La pestaña vive
 * en la URL (`?vista=historial`) para que recargar o volver atrás caiga en la misma.
 */
export default function PaginaConsultas() {
  useTituloPagina({ titulo: 'Consultas' })
  const [params, setParams] = useSearchParams()
  const { contadores } = useContextoMedica()
  const [sinCita, setSinCita] = useState(false)
  const vista: VistaConsultas = params.get('vista') === 'historial' ? 'historial' : 'por-registrar'

  return (
    <div className="mx-auto max-w-[1180px] space-y-4">
      <EncabezadoPagina
        eyebrow="Consultas"
        titulo={vista === 'historial' ? 'Historial de consultas' : 'Consultas por registrar'}
        descripcion={
          vista === 'historial'
            ? 'Abre una consulta para ver su contenido. Cada apertura queda registrada.'
            : 'Registra la consulta o la inasistencia de cada cita que ya empezó. Las que aún no empiezan están en la Agenda.'
        }
        extremo={
          <button
            type="button"
            onClick={() => setSinCita(true)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-brand-600 bg-white px-4 py-2.5 text-[13.5px] font-semibold text-brand-600 hover:bg-brand-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Consulta sin cita
          </button>
        }
      />

      <PestanasVista
        etiqueta="Secciones de consultas"
        pestanas={[
          { vista: 'por-registrar', etiqueta: 'Por registrar', conteo: contadores?.consultasPorRegistrar },
          { vista: 'historial', etiqueta: 'Historial' },
        ]}
        activa={vista}
        onCambiar={(nueva: VistaConsultas) => setParams(nueva === 'historial' ? { vista: 'historial' } : {})}
      >
        {vista === 'historial' ? <HistorialConsultas /> : <ListaPorRegistrar />}
      </PestanasVista>

      {sinCita && <ModalConsultaSinCita onCerrar={() => setSinCita(false)} />}
    </div>
  )
}
