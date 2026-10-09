import { diaSemanaGT, formatFechaLargaGT } from '@akyuam/shared'

const NOMBRES_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

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
}

/** La semana a la vista como una sola tira: una columna por día, todas del mismo ancho. */
export default function NavegadorSemana({
  dias,
  diaAbierto,
  hoy,
  citasPorDia,
  diasSinRegistrar,
  onElegirDia,
}: NavegadorSemanaProps) {
  return (
    <div
      className="grid gap-1.5 rounded-lg border border-gray-200 bg-white p-1.5"
      style={{ gridTemplateColumns: `repeat(${dias.length}, minmax(0, 1fr))` }}
    >
      {dias.map((dia) => {
        const abierto = dia === diaAbierto
        const esHoy = dia === hoy
        const citas = cantidadCitas(citasPorDia.get(dia) ?? 0)
        const pendiente = diasSinRegistrar.has(dia)
        let clases = 'text-gray-700 hover:bg-gray-50'
        if (abierto) clases = 'bg-brand-600 text-white'
        else if (esHoy) clases = 'bg-brand-50 text-brand-800 hover:bg-brand-100'

        return (
          <button
            key={dia}
            type="button"
            aria-pressed={abierto}
            aria-label={`${formatFechaLargaGT(dia)}, ${citas}${pendiente ? ', con citas sin registrar' : ''}`}
            onClick={() => onElegirDia(dia)}
            className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 ${clases}`}
          >
            <span className="text-[11.5px] font-medium opacity-80">
              {esHoy ? 'Hoy' : NOMBRES_CORTOS[diaSemanaGT(dia) - 1]}
            </span>
            <span className="text-[17px] font-semibold leading-tight tabular-nums">{Number(dia.slice(8))}</span>
            <span className="flex items-center gap-1 whitespace-nowrap text-[11px] opacity-85">
              {citas}
              {pendiente && (
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${abierto ? 'bg-amber-300' : 'bg-amber-500'}`} />
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
