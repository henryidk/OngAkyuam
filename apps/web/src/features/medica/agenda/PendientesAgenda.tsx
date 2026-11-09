import { AyudaTermino } from '../../../components/Glosario'
import TarjetaPendiente from '../../../components/TarjetaPendiente'
import { RUTAS_MEDICA } from '../rutas'

interface PendientesAgendaProps {
  /** Total de "Sin próxima consulta" de los contadores del menú; null mientras carga. */
  sinProxima: number | null
}

/**
 * Columna de la Agenda con lo que pide programar: pacientes en atención sin cita. Solo informa y
 * lleva a su lista en Pacientes, que con miles de pacientes tiene páginas y búsqueda. Nunca va en
 * ámbar: no es urgente hoy. Las referencias sin primera consulta no están aquí: siguen en el Área
 * de atención hasta que alguien la agenda.
 */
export default function PendientesAgenda({ sinProxima }: PendientesAgendaProps) {
  return (
    <aside aria-label="Pendientes de programar" className="min-w-0 xl:sticky xl:top-6">
      <TarjetaPendiente
        titulo="Sin próxima consulta"
        ayuda={<AyudaTermino area="medica" termino="sin-proxima" />}
        total={sinProxima}
        contexto="En atención y sin cita programada"
        textoVacio="Todas tienen fecha"
        enlace={{
          to: RUTAS_MEDICA.sinProxima(),
          accion: 'Revisar en Pacientes',
          etiqueta: `${sinProxima ?? 0} ${sinProxima === 1 ? 'paciente sin próxima consulta' : 'pacientes sin próxima consulta'}, revisar`,
        }}
      />
    </aside>
  )
}
