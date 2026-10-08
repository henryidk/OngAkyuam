import { DIAS_ALERTA_ESPERA_PSICOLOGIA, type ReferenciaBandejaPsicologiaDto } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { fechaDeInstante, iniciales } from '../../../lib/formato'
import { etiquetaPersona } from '../compartido/personas'

interface TarjetaReferenciaProps {
  referencia: ReferenciaBandejaPsicologiaDto
  tomando: boolean
  /** Mientras se toma otro caso no se puede tomar este: evita dos tomas a la vez. */
  deshabilitada: boolean
  onTomar: () => void
  onVerExpediente: () => void
}

function textoEspera(dias: number): string {
  if (dias === 0) return 'Llegó hoy'
  return dias === 1 ? '1 día esperando' : `${dias} días esperando`
}

export default function TarjetaReferencia({
  referencia,
  tomando,
  deshabilitada,
  onTomar,
  onVerExpediente,
}: TarjetaReferenciaProps) {
  const enAlerta = referencia.diasEsperando >= DIAS_ALERTA_ESPERA_PSICOLOGIA
  const detalle = [
    `Exp. ${referencia.expedienteNumero}`,
    `Referida ${fechaDeInstante(referencia.referidoEn)}`,
    referencia.referidoPor,
  ]

  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
          >
            {iniciales(referencia.usuariaNombreCompleto)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900">{referencia.usuariaNombreCompleto}</h3>
              {referencia.atendidaAntes && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  Ya atendida antes
                </span>
              )}
              <span
                className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${
                  enAlerta ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {textoEspera(referencia.diasEsperando)}
              </span>
            </div>
            <p className="mt-0.5 text-[13px] text-gray-500 tabular-nums">{detalle.join(' · ')}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Motivo de referencia</p>
            <p className="mt-1 text-sm text-gray-800">{referencia.motivo || 'Sin motivo registrado.'}</p>
          </div>
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-700">Personas a atender:</span>{' '}
            {referencia.personas.map(etiquetaPersona).join(', ')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3">
        <Button variante="secondary" onClick={onVerExpediente}>
          Ver expediente
        </Button>
        <Button cargando={tomando} disabled={deshabilitada} onClick={onTomar}>
          Tomar caso
        </Button>
      </div>
    </article>
  )
}
