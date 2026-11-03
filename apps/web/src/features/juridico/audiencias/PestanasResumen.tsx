import type { LucideIcon } from 'lucide-react'
import { AlertCircle, CalendarDays, CheckCircle2, History } from 'lucide-react'
import { diasDesdeFechaGT, type ResumenAudienciasDto, type VistaAudiencias } from '@akyuam/shared'
import { DIAS_ESPERA_ATRASADA } from './FilaAudiencia'
import { textoEspera } from './formato'

interface PestanasResumenProps {
  vista: VistaAudiencias
  /** `null` mientras carga o si falló: las tarjetas siguen sirviendo de pestañas, sin cifra. */
  resumen: ResumenAudienciasDto | null
  onElegir: (vista: VistaAudiencias) => void
}

type Tono = 'normal' | 'alerta' | 'grave'

interface Tarjeta {
  vista: VistaAudiencias
  titulo: string
  Icono: LucideIcon
  cifra: number | null
  detalle: string
  tono: Tono
}

const CLASES_TONO: Record<Tono, { tarjeta: string; cifra: string; icono: string }> = {
  normal: { tarjeta: 'border-gray-200 bg-white', cifra: 'text-gray-900', icono: 'text-gray-500' },
  alerta: { tarjeta: 'border-amber-300 bg-amber-50', cifra: 'text-amber-800', icono: 'text-amber-600' },
  grave: { tarjeta: 'border-red-300 bg-red-50', cifra: 'text-red-700', icono: 'text-red-600' },
}

function tarjetas(resumen: ResumenAudienciasDto | null): Tarjeta[] {
  const espera = resumen?.pendienteMasAntigua ? diasDesdeFechaGT(resumen.pendienteMasAntigua) : 0
  const pendientes = resumen?.pendientes ?? 0
  return [
    {
      vista: 'proximas',
      titulo: 'Próximas',
      Icono: CalendarDays,
      cifra: resumen?.semana ?? null,
      detalle: resumen ? `en los próximos 7 días · ${resumen.hoy} ${resumen.hoy === 1 ? 'queda' : 'quedan'} hoy` : 'Agenda de los próximos días',
      tono: 'normal',
    },
    {
      vista: 'pendientes',
      titulo: 'Pendientes de resultado',
      Icono: pendientes > 0 ? AlertCircle : CheckCircle2,
      cifra: resumen?.pendientes ?? null,
      detalle: !resumen
        ? 'Ya pasaron y falta registrar qué ocurrió'
        : pendientes > 0
          ? `ya pasaron sin resultado · la más antigua: ${textoEspera(espera).toLowerCase()}`
          : 'Todo al día: no falta ningún resultado',
      // Lo que se olvida aquí es un proceso sin seguimiento: se ve en color, no solo con un número.
      tono: pendientes === 0 ? 'normal' : espera >= DIAS_ESPERA_ATRASADA ? 'grave' : 'alerta',
    },
    {
      vista: 'historial',
      titulo: 'Historial',
      Icono: History,
      cifra: null,
      detalle: 'Realizadas, no realizadas, canceladas y reprogramadas',
      tono: 'normal',
    },
  ]
}

/**
 * Las pestañas son tarjetas con su cifra: lo que hay que atender se ve sin entrar a cada pestaña.
 * Pendientes de resultado se pinta en ámbar (o en rojo si alguna lleva una semana) para que no
 * pase desapercibida.
 */
export default function PestanasResumen({ vista, resumen, onElegir }: PestanasResumenProps) {
  return (
    <div role="tablist" aria-label="Audiencias" className="grid gap-3 sm:grid-cols-3">
      {tarjetas(resumen).map(({ vista: valor, titulo, Icono, cifra, detalle, tono }) => {
        const activa = vista === valor
        const clases = CLASES_TONO[tono]
        return (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={activa}
            onClick={() => onElegir(valor)}
            className={`flex flex-col rounded-xl border px-4 py-3.5 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${clases.tarjeta} ${
              activa ? 'shadow-sm ring-2 ring-brand-600' : 'hover:shadow-sm'
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Icono size={16} aria-hidden="true" className={clases.icono} />
              {titulo}
            </span>
            {cifra !== null && (
              <span className={`mt-2 text-3xl font-semibold leading-none tabular-nums ${clases.cifra}`}>{cifra}</span>
            )}
            <span className="mt-1.5 text-xs leading-snug text-gray-600">{detalle}</span>
          </button>
        )
      })}
    </div>
  )
}
