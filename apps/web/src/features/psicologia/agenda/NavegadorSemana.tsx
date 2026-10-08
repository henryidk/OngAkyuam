import { ChevronLeft, ChevronRight } from 'lucide-react'
import { diaSemanaGT, formatFechaLargaGT } from '@akyuam/shared'

const NOMBRES_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const CLASE_FLECHA = 'rounded-md border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50'

function cantidadCitas(citas: number): string {
  if (citas === 0) return 'Sin citas'
  return citas === 1 ? '1 cita' : `${citas} citas`
}

interface NavegadorSemanaProps {
  dias: string[]
  diaAbierto: string
  hoy: string
  /** Cuántas citas tiene cada día de la semana. */
  citasPorDia: Map<string, number>
  /** Días con alguna cita que ya pasó y sigue sin registro. */
  diasSinRegistrar: Set<string>
  onElegirDia: (dia: string) => void
  onSemanaAnterior: () => void
  onSemanaSiguiente: () => void
  onHoy: () => void
}

/** La semana a la vista: un botón por día y las flechas para moverse de semana en semana. */
export default function NavegadorSemana({
  dias,
  diaAbierto,
  hoy,
  citasPorDia,
  diasSinRegistrar,
  onElegirDia,
  onSemanaAnterior,
  onSemanaSiguiente,
  onHoy,
}: NavegadorSemanaProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Semana anterior" onClick={onSemanaAnterior} className={CLASE_FLECHA}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onHoy}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Hoy
        </button>
        <button type="button" aria-label="Semana siguiente" onClick={onSemanaSiguiente} className={CLASE_FLECHA}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-wrap gap-2">
        {dias.map((dia) => {
          const abierto = dia === diaAbierto
          const citas = cantidadCitas(citasPorDia.get(dia) ?? 0)
          const pendiente = diasSinRegistrar.has(dia)
          let clases = 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          if (abierto) clases = 'border-brand-600 bg-brand-600 text-white'
          else if (dia === hoy) clases = 'border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100'

          return (
            <button
              key={dia}
              type="button"
              aria-pressed={abierto}
              aria-label={`${formatFechaLargaGT(dia)}, ${citas}${pendiente ? ', con citas sin registrar' : ''}`}
              onClick={() => onElegirDia(dia)}
              className={`relative min-w-[4.25rem] flex-1 rounded-lg border px-3 py-2 text-left ${clases}`}
            >
              <span className="block text-[11px] font-medium uppercase tracking-wide opacity-80">
                {NOMBRES_CORTOS[diaSemanaGT(dia) - 1]}
              </span>
              <span className="block text-lg font-semibold leading-tight tabular-nums">{Number(dia.slice(8))}</span>
              <span className="block text-[11px] opacity-80">{citas}</span>
              {pendiente && <span aria-hidden className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
