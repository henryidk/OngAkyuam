import { useEffect, useRef, useState } from 'react'
import { diasDesdeGT, type CasoPorAgendarDto } from '@akyuam/shared'
import TarjetaPendiente from '../../../components/TarjetaPendiente'
import MenuAcciones from '../../../components/ui/MenuAcciones'
import { RUTAS_PSICOLOGIA } from '../rutas'

/** Cuántos casos por agendar se ven de entrada; el resto, al expandir. */
const VISIBLES_POR_AGENDAR = 5
/** Más de esto esperando la primera cita pone la tarjeta en ámbar (plan §5.2.5). */
const DIAS_ESPERA_URGENTE = 7
/** Aire que se deja sobre la fila al desplazar la página hasta ella. */
const MARGEN_SUPERIOR_PX = 96

const BOTON_AGENDAR =
  'whitespace-nowrap rounded-md border border-brand-600 bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-brand-600 hover:bg-brand-50'

function textoEspera(dias: number): string {
  if (dias === 0) return 'tomado hoy'
  return dias === 1 ? 'tomado ayer' : `tomado hace ${dias} días`
}

interface PendientesAgendaProps {
  /** Casos que la psicóloga tomó y siguen sin primera cita; null mientras cargan. */
  porAgendar: CasoPorAgendarDto[] | null
  errorPorAgendar: string | null
  /** Caso recién tomado en el Área de atención: se resalta para que no haya que buscarlo. */
  resaltadoId: string | null
  /** Total de procesos sin próxima cita, el mismo que cuenta el filtro de Procesos; null mientras carga. */
  sinProxima: number | null
  onAgendar: (caso: CasoPorAgendarDto) => void
  /** La persona está aquí: se registra la sesión sin agendar y con ella se abre el proceso. */
  onAtenderAhora: (caso: CasoPorAgendarDto) => void
}

/**
 * Columna de la Agenda con lo pendiente, en dos tarjetas que no desaparecen con 0:
 * - Por agendar: casos tomados sin primera cita. No tienen otra página, así que la lista está
 *   aquí mismo (las 5 que más esperan y el resto al expandir). Ámbar si alguno espera más de 7 días.
 * - Sin próxima cita: procesos activos sin siguiente fecha. Solo informa y lleva al filtro de
 *   Procesos, que con muchos procesos tiene páginas y búsqueda. Nunca va en ámbar.
 */
export default function PendientesAgenda({
  porAgendar,
  errorPorAgendar,
  resaltadoId,
  sinProxima,
  onAgendar,
  onAtenderAhora,
}: PendientesAgendaProps) {
  const [expandida, setExpandida] = useState(false)
  const filaResaltada = useRef<HTMLLIElement>(null)

  // Del que más espera al más reciente.
  const ordenados = porAgendar ? [...porAgendar].sort((a, b) => a.tomadaEn.localeCompare(b.tomadaEn)) : null
  const total = ordenados?.length ?? null
  const maxEspera = ordenados && ordenados.length > 0 ? diasDesdeGT(ordenados[0].tomadaEn) : 0
  const posicionResaltado = ordenados?.findIndex((caso) => caso.referidoId === resaltadoId) ?? -1
  // El recién tomado siempre se ve, aunque caiga después de los primeros 5.
  const mostrarTodos = expandida || posicionResaltado >= VISIBLES_POR_AGENDAR
  const visibles = (mostrarTodos ? ordenados : ordenados?.slice(0, VISIBLES_POR_AGENDAR)) ?? []
  const hayResaltado = posicionResaltado >= 0

  // El caso recién tomado se lleva a la vista una vez, cuando ya está pintado.
  useEffect(() => {
    const fila = filaResaltada.current
    if (!hayResaltado || !fila) return
    const arriba = fila.getBoundingClientRect().top + window.scrollY - MARGEN_SUPERIOR_PX
    window.scrollTo({ top: Math.max(arriba, 0), behavior: 'smooth' })
  }, [hayResaltado])

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <TarjetaPendiente
        titulo="Casos tomados por agendar"
        total={errorPorAgendar ? null : total}
        contexto={maxEspera > 0 ? `El que más espera: ${maxEspera === 1 ? '1 día' : `${maxEspera} días`}` : 'Tomados hoy'}
        textoVacio="Todos tienen primera cita"
        urgente={maxEspera > DIAS_ESPERA_URGENTE}
      >
        {errorPorAgendar && <p className="border-t border-borde px-4 py-2 text-[12.5px] text-red-600">{errorPorAgendar}</p>}
        {visibles.length > 0 && (
          <ul aria-label="Casos por agendar" className="flex flex-col border-t border-borde px-4">
            {visibles.map((caso) => {
              const resaltado = caso.referidoId === resaltadoId
              return (
                <li
                  key={caso.referidoId}
                  ref={resaltado ? filaResaltada : undefined}
                  className={`-mx-2 flex items-center justify-between gap-3 border-t border-borde-suave px-2 py-2 first:border-t-0 ${
                    resaltado ? 'rounded-md bg-seleccion' : ''
                  }`}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[13px] font-medium text-texto" title={caso.usuariaNombreCompleto}>
                      {caso.usuariaNombreCompleto}
                    </span>
                    <span className="text-xs text-texto-suave tabular-nums">
                      Exp. {caso.expedienteNumero} · {textoEspera(diasDesdeGT(caso.tomadaEn))}
                    </span>
                  </div>
                  <div className="flex flex-none items-center gap-1">
                    <button type="button" onClick={() => onAgendar(caso)} className={BOTON_AGENDAR}>
                      Agendar
                    </button>
                    <MenuAcciones
                      etiqueta={`Más acciones para ${caso.usuariaNombreCompleto}`}
                      opciones={[
                        {
                          clave: 'atender-ahora',
                          etiqueta: 'Atender ahora',
                          detalle: 'La persona está aquí: registras la sesión sin agendar.',
                          onElegir: () => onAtenderAhora(caso),
                        },
                      ]}
                    />
                  </div>
                </li>
              )
            })}
            {total !== null && total > VISIBLES_POR_AGENDAR && posicionResaltado < VISIBLES_POR_AGENDAR && (
              <li className="border-t border-borde-suave py-2">
                <button
                  type="button"
                  aria-expanded={expandida}
                  onClick={() => setExpandida((valor) => !valor)}
                  className="text-[12.5px] font-medium text-brand-600 underline underline-offset-2"
                >
                  {expandida ? 'Ver menos' : `Ver los ${total}`}
                </button>
              </li>
            )}
          </ul>
        )}
        {total !== null && total > 0 && (
          <p className="border-t border-borde px-4 py-2 text-xs text-texto-suave">
            Al programar la primera cita se abre el proceso.
          </p>
        )}
      </TarjetaPendiente>

      <TarjetaPendiente
        titulo="Sin próxima cita"
        total={sinProxima}
        contexto="Procesos activos sin siguiente fecha"
        textoVacio="Todos tienen fecha"
        enlace={{
          to: RUTAS_PSICOLOGIA.procesos('SIN_PROXIMA'),
          accion: 'Revisar en Procesos',
          etiqueta: `${sinProxima ?? 0} ${sinProxima === 1 ? 'proceso sin próxima cita' : 'procesos sin próxima cita'}, revisar en Procesos`,
        }}
      />
    </div>
  )
}
