import { useEffect, useRef } from 'react'
import type { CasoPorAgendarDto } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { fechaDeInstante } from '../../../lib/formato'

/** Aire que se deja sobre la tarjeta al desplazar la página hasta ella. */
const MARGEN_SUPERIOR_PX = 96

interface PanelPorAgendarProps {
  casos: CasoPorAgendarDto[] | null
  error: string | null
  /** Caso recién tomado en el Área de atención: se resalta para que no haya que buscarlo. */
  resaltadoId: string | null
  onAgendar: (caso: CasoPorAgendarDto) => void
}

/** Casos que la psicóloga ya tomó y siguen sin primera cita: mientras estén aquí, no hay proceso. */
export default function PanelPorAgendar({ casos, error, resaltadoId, onAgendar }: PanelPorAgendarProps) {
  const tarjetaResaltada = useRef<HTMLDivElement>(null)
  const hayResaltado = casos?.some((caso) => caso.referidoId === resaltadoId) ?? false

  // El caso recién tomado se lleva a la vista una vez, cuando ya está pintado.
  useEffect(() => {
    const tarjeta = tarjetaResaltada.current
    if (!hayResaltado || !tarjeta) return
    const arriba = tarjeta.getBoundingClientRect().top + window.scrollY - MARGEN_SUPERIOR_PX
    window.scrollTo({ top: Math.max(arriba, 0), behavior: 'smooth' })
  }, [hayResaltado])

  // Sin casos el panel no aporta nada: la agenda queda solo con lo que sí pide atención.
  if (!error && casos?.length === 0) return null

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">
          Casos tomados por agendar{casos ? ` · ${casos.length}` : ''}
        </h2>
        <p className="text-xs text-gray-500">Al programar la primera cita se abre el proceso.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!casos && !error && <p className="text-sm text-gray-500">Cargando…</p>}

      <div className="space-y-2">
        {casos?.map((caso) => (
          <div
            key={caso.referidoId}
            ref={caso.referidoId === resaltadoId ? tarjetaResaltada : undefined}
            className={`rounded-lg border bg-white p-3 shadow-sm ${
              caso.referidoId === resaltadoId ? 'border-brand-500 ring-1 ring-brand-500' : 'border-gray-200'
            }`}
          >
            <p className="truncate text-sm font-medium text-gray-800">{caso.usuariaNombreCompleto}</p>
            <p className="text-xs text-gray-500 tabular-nums">
              Exp. {caso.expedienteNumero} · tomado {fechaDeInstante(caso.tomadaEn)}
            </p>
            <Button tamano="sm" className="mt-3" onClick={() => onAgendar(caso)}>
              Agendar primera cita
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}
