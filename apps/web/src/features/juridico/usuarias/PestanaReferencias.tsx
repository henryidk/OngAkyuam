import { ETIQUETAS_TIPO_PROCESO_JURIDICO, type EstadoReferenciaJuridico } from '@akyuam/shared'
import { fechaDeInstante } from '../compartido/formato'
import { useContextoFicha } from './contextoFicha'

const ESTADO: Record<EstadoReferenciaJuridico, { etiqueta: string; clase: string }> = {
  PENDIENTE: { etiqueta: 'Pendiente', clase: 'bg-[#fef3c7] text-[#b45309]' },
  ATENDIDA: { etiqueta: 'Atendida', clase: 'bg-[#dcfce7] text-[#15803d]' },
  DEVUELTA: { etiqueta: 'Devuelta', clase: 'bg-[#f3f4f6] text-[#374151]' },
}

export default function PestanaReferencias() {
  const { ficha } = useContextoFicha()

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <h3 className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-900">
        Referencias recibidas de Trabajo Social
      </h3>
      {ficha.referencias.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-500">No hay referencias registradas.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {ficha.referencias.map((referencia) => (
            <li key={referencia.referidoId} className="grid gap-3 px-5 py-3 sm:grid-cols-[110px_1fr_auto] sm:items-start">
              <span className="text-xs text-gray-500 tabular-nums">{fechaDeInstante(referencia.referidoEn)}</span>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm text-gray-800">{referencia.motivo || 'Sin motivo registrado.'}</p>
                <p className="text-xs text-gray-500">
                  Expediente {referencia.expedienteNumero} · por {referencia.referidoPor}
                  {referencia.procesosSugeridos.length > 0 &&
                    ` · Sugerido: ${referencia.procesosSugeridos
                      .map((tipo) => ETIQUETAS_TIPO_PROCESO_JURIDICO[tipo])
                      .join(', ')}`}
                </p>
                {referencia.estado === 'DEVUELTA' && referencia.motivoDevolucion && (
                  <p className="text-xs text-gray-600">
                    <strong className="font-semibold">Devuelta:</strong> {referencia.motivoDevolucion}
                  </p>
                )}
              </div>
              <span
                className={`justify-self-start rounded-full px-2.5 py-0.5 text-xs font-medium sm:justify-self-end ${ESTADO[referencia.estado].clase}`}
              >
                {ESTADO[referencia.estado].etiqueta}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
