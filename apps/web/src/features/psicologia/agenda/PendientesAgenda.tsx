import { AyudaTermino } from '../../../components/Glosario'
import TarjetaPendiente from '../../../components/TarjetaPendiente'
import { RUTAS_PSICOLOGIA } from '../rutas'

interface PendientesAgendaProps {
  /** Total de procesos sin próxima cita, el mismo que cuenta el filtro de Procesos; null mientras carga. */
  sinProxima: number | null
}

/**
 * Columna de la Agenda con lo que pide programar: los procesos activos sin siguiente fecha. Solo
 * informa y lleva al filtro de Procesos, que con muchos procesos tiene páginas y búsqueda. Las
 * referencias sin primera cita no están aquí: siguen en el Área de atención hasta que alguien
 * confirma su primera cita.
 */
export default function PendientesAgenda({ sinProxima }: PendientesAgendaProps) {
  return (
    <TarjetaPendiente
      titulo="Sin próxima cita"
      ayuda={<AyudaTermino area="psicologia" termino="sin-proxima" />}
      total={sinProxima}
      contexto="Procesos activos sin siguiente fecha"
      textoVacio="Todos tienen fecha"
      enlace={{
        to: RUTAS_PSICOLOGIA.procesos('SIN_PROXIMA'),
        accion: 'Revisar en Procesos',
        etiqueta: `${sinProxima ?? 0} ${sinProxima === 1 ? 'proceso sin próxima cita' : 'procesos sin próxima cita'}, revisar en Procesos`,
      }}
    />
  )
}
