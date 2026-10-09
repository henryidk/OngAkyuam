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
              {referencia.atendidaAntes && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  Ya atendida antes
                </span>
              )}
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
          <Button variante="secondary" tamano="sm" onClick={onVerExpediente}>
            Ver expediente
          </Button>
          <Button tamano="sm" cargando={tomando} disabled={deshabilitada} onClick={onTomar}>
            Tomar caso
          </Button>
        </div>
      </div>
    </article>
  )
}
