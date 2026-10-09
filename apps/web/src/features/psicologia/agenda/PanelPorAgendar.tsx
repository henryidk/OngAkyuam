import { useEffect, useRef } from 'react'
import type { CasoPorAgendarDto } from '@akyuam/shared'
import { fechaDeInstante } from '../../../lib/formato'
import { BOTON_COLA_RELLENO } from './estilos'
import TarjetaCola, { FilaCola } from './TarjetaCola'

/** Aire que se deja sobre la fila al desplazar la página hasta ella. */
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
  const filaResaltada = useRef<HTMLDivElement>(null)
  const hayResaltado = casos?.some((caso) => caso.referidoId === resaltadoId) ?? false

  // El caso recién tomado se lleva a la vista una vez, cuando ya está pintado.
  useEffect(() => {
    const fila = filaResaltada.current
    if (!hayResaltado || !fila) return
    const arriba = fila.getBoundingClientRect().top + window.scrollY - MARGEN_SUPERIOR_PX
    window.scrollTo({ top: Math.max(arriba, 0), behavior: 'smooth' })
  }, [hayResaltado])

  // Sin casos el panel no aporta nada: la agenda queda solo con lo que sí pide atención.
  if (!error && casos?.length === 0) return null

  return (
    <TarjetaCola
      tono="marca"
      titulo={`Casos tomados por agendar${casos ? ` · ${casos.length}` : ''}`}
      ayuda="Al programar la primera cita se abre el proceso."
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!casos && !error && <p className="text-sm text-gray-500">Cargando…</p>}

      {casos?.map((caso) => (
        <FilaCola
          key={caso.referidoId}
          ref={caso.referidoId === resaltadoId ? filaResaltada : undefined}
          resaltada={caso.referidoId === resaltadoId}
          nombre={caso.usuariaNombreCompleto}
          detalle={`Exp. ${caso.expedienteNumero} · tomado ${fechaDeInstante(caso.tomadaEn)}`}
        >
          <button type="button" onClick={() => onAgendar(caso)} className={BOTON_COLA_RELLENO}>
            Agendar primera cita
          </button>
        </FilaCola>
      ))}
    </TarjetaCola>
  )
}
