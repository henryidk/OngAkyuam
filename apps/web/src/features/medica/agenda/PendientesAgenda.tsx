import { Link } from 'react-router-dom'
import { diasDesdeGT, type ReferenciaBandejaMedicaDto } from '@akyuam/shared'
import TarjetaPendiente from '../../../components/TarjetaPendiente'
import { RUTAS_MEDICA } from '../rutas'

/** Cuántas por agendar se ven bajo la tarjeta; el resto, en el Área de atención. */
const VISIBLES_POR_AGENDAR = 5
/** Más de esto esperando la primera consulta pone la tarjeta en ámbar (plan §5.2.5). */
const DIAS_ESPERA_URGENTE = 7

const BOTON_AGENDAR =
  'whitespace-nowrap rounded-md border border-brand-600 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-brand-600 hover:bg-brand-50'

function textoEspera(dias: number): string {
  if (dias === 0) return 'Referida hoy'
  return dias === 1 ? 'Espera desde ayer' : `Espera desde hace ${dias} días`
}

interface PendientesAgendaProps {
  /** Referencias del Área de atención; null mientras cargan. */
  porAgendar: ReferenciaBandejaMedicaDto[] | null
  /** Total de "Sin próxima consulta" de los contadores del menú; null mientras carga. */
  sinProxima: number | null
  onAgendar: (referidoId: string) => void
}

/**
 * Columna de la Agenda con lo pendiente, en dos tarjetas que solo informan y llevan a su lista:
 * - Por agendar: referencias de Trabajo Social sin primera consulta. Se ven las que más esperan,
 *   con su botón; la lista completa está en el Área de atención.
 * - Sin próxima consulta: pacientes en atención sin cita; su lista vive en Pacientes, con páginas
 *   y búsqueda, porque con miles de pacientes no cabe aquí. Nunca va en ámbar: no es urgente hoy.
 */
export default function PendientesAgenda({ porAgendar, sinProxima, onAgendar }: PendientesAgendaProps) {
  // De la que más espera a la más reciente.
  const ordenadas = porAgendar ? [...porAgendar].sort((a, b) => a.referidoEn.localeCompare(b.referidoEn)) : null
  const total = ordenadas?.length ?? null
  const maxEspera = ordenadas && ordenadas.length > 0 ? diasDesdeGT(ordenadas[0].referidoEn) : 0
  const visibles = ordenadas?.slice(0, VISIBLES_POR_AGENDAR) ?? []

  return (
    <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
      <TarjetaPendiente
        titulo="Por agendar"
        total={total}
        contexto={maxEspera > 0 ? `La que más espera: ${maxEspera === 1 ? '1 día' : `${maxEspera} días`}` : 'Referidas hoy'}
        textoVacio="Todas tienen primera consulta"
        enlace={{
          to: RUTAS_MEDICA.atencion(),
          accion: 'Ver en Área de atención',
          etiqueta: `${total ?? 0} ${total === 1 ? 'paciente por agendar' : 'pacientes por agendar'}, ver en Área de atención`,
        }}
        urgente={maxEspera > DIAS_ESPERA_URGENTE}
      >
        {visibles.length > 0 && (
          <ul aria-label="Las que más esperan" className="flex flex-col border-t border-borde px-4">
            {visibles.map((referencia) => (
              <li
                key={referencia.referidoId}
                className="flex items-center justify-between gap-3 border-t border-borde-suave py-2 first:border-t-0"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[13px] font-medium text-texto">{referencia.usuariaNombreCompleto}</span>
                  <span className="text-xs text-texto-suave">{textoEspera(diasDesdeGT(referencia.referidoEn))}</span>
                </div>
                <button type="button" onClick={() => onAgendar(referencia.referidoId)} className={BOTON_AGENDAR}>
                  Agendar
                </button>
              </li>
            ))}
            {total !== null && total > VISIBLES_POR_AGENDAR && (
              <li className="border-t border-borde-suave py-2">
                <Link
                  to={RUTAS_MEDICA.atencion()}
                  className="text-[12.5px] font-medium text-brand-600 underline underline-offset-2"
                >
                  Ver las {total}
                </Link>
              </li>
            )}
          </ul>
        )}
      </TarjetaPendiente>

      <TarjetaPendiente
        titulo="Sin próxima consulta"
        total={sinProxima}
        contexto="En atención y sin cita programada"
        textoVacio="Todas tienen fecha"
        enlace={{
          to: RUTAS_MEDICA.sinProxima(),
          accion: 'Revisar en Pacientes',
          etiqueta: `${sinProxima ?? 0} ${sinProxima === 1 ? 'paciente sin próxima consulta' : 'pacientes sin próxima consulta'}, revisar`,
        }}
      />
    </div>
  )
}
