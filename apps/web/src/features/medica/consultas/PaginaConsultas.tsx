import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useTituloPagina } from '../../../components/TituloPagina'
import { useContextoMedica } from '../compartido/contexto'
import EncabezadoPagina from '../compartido/EncabezadoPagina'
import type { VistaConsultas } from '../rutas'
import HistorialConsultas from './historial/HistorialConsultas'
import ModalConsultaSinCita from './ModalConsultaSinCita'
import ListaPorAtender from './porAtender/ListaPorAtender'

const PESTANAS: { vista: VistaConsultas; etiqueta: string }[] = [
  { vista: 'por-atender', etiqueta: 'Por atender' },
  { vista: 'historial', etiqueta: 'Historial' },
]

/**
 * Consultas: lo que hay que atender o registrar y el historial de lo registrado. La pestaña vive
 * en la URL (`?vista=historial`) para que recargar o volver atrás caiga en la misma.
 */
export default function PaginaConsultas() {
  useTituloPagina({ titulo: 'Consultas' })
  const [params, setParams] = useSearchParams()
  const { contadores } = useContextoMedica()
  const [sinCita, setSinCita] = useState(false)
  const vista: VistaConsultas = params.get('vista') === 'historial' ? 'historial' : 'por-atender'

  return (
    <div className="mx-auto max-w-[1180px] space-y-4">
      <EncabezadoPagina
        eyebrow="Consultas"
        titulo={vista === 'historial' ? 'Historial de consultas' : 'Por atender'}
        descripcion={
          vista === 'historial'
            ? 'Abre una consulta para ver su contenido. Cada apertura queda registrada.'
            : 'Registra la consulta o la inasistencia de cada cita.'
        }
        extremo={
          <button
            type="button"
            onClick={() => setSinCita(true)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-[#7346a5] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#7346a5] hover:bg-[#f7f3fc]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Consulta sin cita
          </button>
        }
      />

      <nav aria-label="Secciones de consultas" className="flex gap-1 border-b border-[#e3e6ea]">
        {PESTANAS.map((pestana) => {
          const activa = pestana.vista === vista
          const conteo = pestana.vista === 'por-atender' ? contadores?.consultasPorAtender : undefined
          return (
            <button
              key={pestana.vista}
              type="button"
              aria-current={activa ? 'page' : undefined}
              onClick={() => setParams(pestana.vista === 'historial' ? { vista: 'historial' } : {})}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${
                activa ? 'border-[#7346a5] text-[#5b3985]' : 'border-transparent text-[#5b6573] hover:text-[#1c2430]'
              }`}
            >
              {pestana.etiqueta}
              {conteo !== undefined && conteo > 0 && <span className="ml-1.5 tabular-nums text-[#5b6573]">{conteo}</span>}
            </button>
          )
        })}
      </nav>

      {vista === 'historial' ? <HistorialConsultas /> : <ListaPorAtender />}

      {sinCita && <ModalConsultaSinCita onCerrar={() => setSinCita(false)} />}
    </div>
  )
}
