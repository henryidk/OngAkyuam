import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { DIAS_ALERTA_ESPERA_PSICOLOGIA, type ReferenciaBandejaPsicologiaDto } from '@akyuam/shared'
import EtiquetaIngreso from '../../../components/EtiquetaIngreso'
import Button from '../../../components/ui/Button'
import MenuAcciones from '../../../components/ui/MenuAcciones'
import { fechaDeInstante, iniciales, textoReserva } from '../../../lib/formato'
import { etiquetaPersona } from '../compartido/personas'
import { RUTAS_PSICOLOGIA } from '../rutas'

interface TarjetaReferenciaProps {
  referencia: ReferenciaBandejaPsicologiaDto
  /** Se está reservando esta referencia para abrir la agenda o "Atender ahora". */
  tomando: boolean
  /** Mientras se reserva otra referencia no se puede empezar esta: evita dos a la vez. */
  deshabilitada: boolean
  /** Reserva la referencia y abre la agenda con su primera cita: el caso se toma al confirmarla. */
  onTomar: () => void
  /** Reserva la referencia y registra la sesión de la persona que está aquí, sin agendar. */
  onAtenderAhora: () => void
}

const CLASE_ENLACE_BOTON =
  'inline-flex items-center rounded-md border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50'

function textoEspera(dias: number): string {
  if (dias === 0) return 'Llegó hoy'
  return dias === 1 ? '1 día esperando' : `${dias} días esperando`
}

export default function TarjetaReferencia({
  referencia,
  tomando,
  deshabilitada,
  onTomar,
  onAtenderAhora,
}: TarjetaReferenciaProps) {
  const enAlerta = referencia.diasEsperando >= DIAS_ALERTA_ESPERA_PSICOLOGIA
  // La reserva propia (otra pestaña de la misma psicóloga) no bloquea: es suya.
  const ajena = referencia.reserva && !referencia.reserva.propia ? referencia.reserva : null
  const detalle = [
    `Exp. ${referencia.expedienteNumero}`,
    `Referida ${fechaDeInstante(referencia.referidoEn)}`,
    referencia.referidoPor,
  ]

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
          >
            {iniciales(referencia.usuariaNombreCompleto)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900">{referencia.usuariaNombreCompleto}</h3>
              <EtiquetaIngreso ingreso={referencia.ingreso} />
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${
                  enAlerta ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {textoEspera(referencia.diasEsperando)}
              </span>
            </div>
            <p className="mt-0.5 text-[13px] text-gray-500 tabular-nums">{detalle.join(' · ')}</p>
            <p className="mt-2 text-sm text-gray-800">
              <span className="font-medium text-gray-700">Motivo:</span>{' '}
              {referencia.motivo || 'Sin motivo registrado.'}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              <span className="font-medium text-gray-700">Personas a atender:</span>{' '}
              {referencia.personas.map(etiquetaPersona).join(', ')}
            </p>
          </div>
        </div>

        {/* A la derecha del encabezado; en pantallas angostas (< 768 px) baja a su propia fila. */}
        <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 pt-3 md:border-t-0 md:pt-0">
          {/* Igual que en Jurídico: abre la ficha de la usuaria, donde también se puede agendar. */}
          <Link
            to={RUTAS_PSICOLOGIA.usuaria(referencia.usuariaId)}
            aria-label={`Ver expediente de ${referencia.usuariaNombreCompleto}`}
            className={CLASE_ENLACE_BOTON}
          >
            Ver expediente
          </Link>
          {ajena ? (
            // Otra psicóloga la está agendando o atendiendo: el caso sigue sin tomar, pero no se
            // puede empezar a la vez. Vuelve a habilitarse cuando la suelte o venza su reserva.
            <Button
              variante="secondary"
              tamano="md"
              disabled
              aria-label={`Caso de ${referencia.usuariaNombreCompleto}: ${textoReserva(ajena)}`}
            >
              <Clock aria-hidden="true" className="h-3.5 w-3.5" />
              {textoReserva(ajena)}
            </Button>
          ) : (
            <>
              <Button
                tamano="md"
                cargando={tomando}
                disabled={deshabilitada}
                onClick={onTomar}
                aria-label={`Tomar el caso de ${referencia.usuariaNombreCompleto}`}
              >
                Tomar caso
              </Button>
              {/* Lo habitual es agendar; atender sin cita es la excepción, por eso va aparte. */}
              {!deshabilitada && (
                <MenuAcciones
                  etiqueta={`Más acciones para ${referencia.usuariaNombreCompleto}`}
                  boton="borde"
                  opciones={[
                    {
                      clave: 'atender-ahora',
                      etiqueta: 'Atender ahora',
                      detalle: 'La persona está aquí: registras la sesión sin agendar y con ella tomas el caso.',
                      onElegir: onAtenderAhora,
                    },
                  ]}
                />
              )}
            </>
          )}
        </div>
      </div>
    </article>
  )
}
