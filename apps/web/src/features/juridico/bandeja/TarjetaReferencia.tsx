import { Link } from 'react-router-dom'
import { ETIQUETAS_TIPO_PROCESO_JURIDICO, type ReferenciaBandejaDto, type TipoProcesoJuridico } from '@akyuam/shared'
import { fechaDeInstante, iniciales } from '../compartido/formato'
import { RUTAS_JURIDICO } from '../rutas'

interface TarjetaReferenciaProps {
  referencia: ReferenciaBandejaDto
  onDevolver: () => void
}

const CLASE_ENLACE_BOTON = 'inline-flex items-center rounded-md px-3.5 py-2 text-sm font-medium transition-colors'

export default function TarjetaReferencia({ referencia, onDevolver }: TarjetaReferenciaProps) {
  const { usuaria } = referencia
  const devuelta = referencia.devueltoEn !== null
  const activoDe = (tipo: TipoProcesoJuridico) => referencia.activosPorTipo.find((activo) => activo.tipo === tipo)

  const detalle = [
    `Expediente ${referencia.expedienteNumero}`,
    `${referencia.edad} años`,
    referencia.municipio,
    `referida por ${referencia.referidoPor}`,
  ].filter(Boolean)

  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
          >
            {iniciales(usuaria.nombreCompleto)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">{usuaria.nombreCompleto}</h2>
              {!devuelta && referencia.atendidaAntes && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  Ya atendida antes
                </span>
              )}
              <span className="ml-auto text-xs text-gray-500 tabular-nums">
                {devuelta ? `Devuelta ${fechaDeInstante(referencia.devueltoEn!)}` : fechaDeInstante(referencia.referidoEn)}
              </span>
            </div>
            <p className="mt-0.5 text-[13px] text-gray-500 tabular-nums">{detalle.join(' · ')}</p>
          </div>
        </div>

        <p className="mt-3 text-sm text-gray-800">{referencia.motivo || 'Sin motivo registrado.'}</p>

        {referencia.procesosSugeridos.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-500">Sugerido:</span>
            {referencia.procesosSugeridos.map((tipo) => {
              const activo = devuelta ? undefined : activoDe(tipo)
              const tono = devuelta
                ? 'bg-gray-100 text-gray-600'
                : activo
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-brand-100 text-brand-700'
              return (
                <span key={tipo} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tono}`}>
                  {ETIQUETAS_TIPO_PROCESO_JURIDICO[tipo]}
                  {activo && ` · ya activo (${activo.codigo})`}
                </span>
              )
            })}
          </div>
        )}

        {devuelta && (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Motivo de la devolución</p>
            <p className="mt-1 text-sm text-gray-800">{referencia.motivoDevolucion}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3">
        {!devuelta && (
          <button
            type="button"
            onClick={onDevolver}
            className="rounded px-1 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline"
          >
            Devolver a Trabajo Social
          </button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Link
            to={RUTAS_JURIDICO.usuaria(usuaria.id)}
            className={`${CLASE_ENLACE_BOTON} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
          >
            Ver expediente
          </Link>
          {!devuelta && (
            <Link
              to={RUTAS_JURIDICO.registrar({ expedienteId: referencia.expedienteId, referidoId: referencia.referidoId })}
              className={`${CLASE_ENLACE_BOTON} bg-brand-600 text-white hover:bg-brand-700`}
            >
              Atender caso
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
