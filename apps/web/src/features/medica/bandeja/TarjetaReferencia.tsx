import { Clock } from 'lucide-react'
import { ETIQUETAS_INGRESO_AREA, diasDesdeGT, type ReferenciaBandejaMedicaDto } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { fechaDeInstante, iniciales, textoReserva } from '../../../lib/formato'
import Chip from '../compartido/Chip'
import { CLASE_TARJETA } from '../compartido/estilos'
import { etiquetaPersonaChip } from '../compartido/personas'

function ChipEspera({ referidoEn }: { referidoEn: string }) {
  const dias = diasDesdeGT(referidoEn)
  if (dias === 0) return <Chip tono="gray">Referida hoy</Chip>
  if (dias === 1) return <Chip tono="gray">Hace 1 día</Chip>
  return <Chip tono="amber">Hace {dias} días</Chip>
}

interface TarjetaReferenciaProps {
  referencia: ReferenciaBandejaMedicaDto
  onVerExpediente: () => void
  /** Reserva la referencia y abre la agenda con su primera consulta. */
  onAgendar: () => void
  /** Esta tarjeta está reservando: el botón muestra que carga. */
  reservando: boolean
  /** Otra tarjeta está reservando: no se empieza otra a la vez. */
  deshabilitada: boolean
}

export default function TarjetaReferencia({
  referencia,
  onVerExpediente,
  onAgendar,
  reservando,
  deshabilitada,
}: TarjetaReferenciaProps) {
  // La reserva propia (otra pestaña de la misma médica) no bloquea: es suya.
  const ajena = referencia.reserva && !referencia.reserva.propia ? referencia.reserva : null
  return (
    <article className={`${CLASE_TARJETA} px-5 py-4`}>
      <div className="flex flex-wrap items-start gap-3.5">
        <div
          aria-hidden="true"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-50 text-[13px] font-semibold text-brand-600"
        >
          {iniciales(referencia.usuariaNombreCompleto)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-texto">{referencia.usuariaNombreCompleto}</h3>
            <Chip tono={referencia.ingreso === 'PRIMER_INGRESO' ? 'purple' : 'gray'}>
              {ETIQUETAS_INGRESO_AREA[referencia.ingreso]}
            </Chip>
            <ChipEspera referidoEn={referencia.referidoEn} />
          </div>
          <p className="mt-0.5 text-[13px] text-texto-suave">
            Exp. {referencia.expedienteNumero} · {referencia.edad} años · Referida {fechaDeInstante(referencia.referidoEn)} por{' '}
            {referencia.referidoPor}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variante="secondary"
            onClick={onVerExpediente}
            aria-label={`Ver expediente de ${referencia.usuariaNombreCompleto}`}
          >
            Ver expediente
          </Button>
          {ajena ? (
            // Otra persona la está agendando: sigue sin primera consulta, pero no se agenda a la vez.
            // Vuelve a habilitarse cuando la suelte o venza su reserva.
            <Button
              variante="secondary"
              disabled
              aria-label={`Caso de ${referencia.usuariaNombreCompleto}: ${textoReserva(ajena)}`}
            >
              <Clock aria-hidden="true" className="h-3.5 w-3.5" />
              {textoReserva(ajena)}
            </Button>
          ) : (
            <Button
              onClick={onAgendar}
              cargando={reservando}
              disabled={deshabilitada}
              aria-label={`Agendar la primera consulta de ${referencia.usuariaNombreCompleto}`}
            >
              Agendar primera consulta
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2 sm:pl-[50px]">
        {referencia.motivo && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-texto-suave">Motivo</p>
            <p className="mt-0.5 whitespace-pre-line text-sm text-texto">{referencia.motivo}</p>
          </div>
        )}
        {referencia.personas.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-texto-suave">
            <span>Pacientes:</span>
            {referencia.personas.map((persona) => (
              <span
                key={persona.ninoId ?? 'usuaria'}
                className="rounded-full border border-borde bg-superficie px-2 py-0.5 text-[12px] text-texto"
              >
                {etiquetaPersonaChip(persona)}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
