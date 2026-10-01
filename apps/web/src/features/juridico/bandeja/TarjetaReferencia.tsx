import { Link } from 'react-router-dom'
import { ETIQUETAS_TIPO_PROCESO_JURIDICO, type ReferenciaBandejaDto } from '@akyuam/shared'
import Badge from '../../../components/ui/Badge'
import Button from '../../../components/ui/Button'
import { fechaDeInstante, iniciales } from '../compartido/formato'
import { RUTAS_JURIDICO } from '../rutas'

interface TarjetaReferenciaProps {
  referencia: ReferenciaBandejaDto
  onVerDatos: () => void
  onDevolver: () => void
}

const CLASE_ENLACE_BOTON =
  'inline-flex items-center rounded-md px-3.5 py-2 text-sm font-medium transition-colors'

export default function TarjetaReferencia({ referencia, onVerDatos, onDevolver }: TarjetaReferenciaProps) {
  const { usuaria } = referencia
  const devuelta = referencia.devueltoEn !== null

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
        >
          {iniciales(usuaria.nombreCompleto)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold text-gray-900">{usuaria.nombreCompleto}</h2>
            {referencia.prioridad === 'URGENTE' && <Badge tono="danger">Urgente</Badge>}
          </div>
          <p className="text-xs text-gray-500 tabular-nums">
            {usuaria.dpi ? `DPI ${usuaria.dpi}` : 'Sin DPI registrado'} · Expediente {referencia.expedienteNumero}
          </p>
          <p className="text-xs text-gray-500">
            Referida {fechaDeInstante(referencia.referidoEn)} · {referencia.referidoPor}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Motivo de referencia</p>
        <p className="mt-1 text-sm text-gray-800">{referencia.motivo || 'Sin motivo registrado.'}</p>
        {referencia.procesosSugeridos.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-500">Sugerido por TS:</span>
            {referencia.procesosSugeridos.map((tipo) => (
              <Badge key={tipo} tono="brand">
                {ETIQUETAS_TIPO_PROCESO_JURIDICO[tipo]}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
        {devuelta ? (
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Devuelta {fechaDeInstante(referencia.devueltoEn!)}:</span>{' '}
            {referencia.motivoDevolucion}
          </p>
        ) : (
          <>
            <Link
              to={RUTAS_JURIDICO.registrar({ expedienteId: referencia.expedienteId, referidoId: referencia.referidoId })}
              className={`${CLASE_ENLACE_BOTON} bg-brand-600 text-white hover:bg-brand-700`}
            >
              Atender caso →
            </Link>
            <Link
              to={RUTAS_JURIDICO.usuaria(usuaria.id)}
              className={`${CLASE_ENLACE_BOTON} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
            >
              Ver expediente
            </Link>
            <Button variante="secondary" tamano="md" onClick={onVerDatos}>
              Ver datos de la usuaria
            </Button>
            <button
              type="button"
              onClick={onDevolver}
              className="ml-auto rounded px-2 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline"
            >
              Devolver a Trabajo Social
            </button>
          </>
        )}
      </div>
    </article>
  )
}
