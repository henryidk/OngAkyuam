import { ETIQUETAS_INGRESO_AREA, diasDesdeGT, type ReferenciaBandejaMedicaDto } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { fechaDeInstante, iniciales } from '../../../lib/formato'
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
  onAgendar: () => void
}

export default function TarjetaReferencia({ referencia, onVerExpediente, onAgendar }: TarjetaReferenciaProps) {
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
          <Button onClick={onAgendar} aria-label={`Agendar la primera consulta de ${referencia.usuariaNombreCompleto}`}>
            Agendar primera consulta
          </Button>
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
