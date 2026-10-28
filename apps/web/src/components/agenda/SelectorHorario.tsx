import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatFechaLargaGT, hoyGT, lunesDeSemanaGT, sumarDiasGT, type DisponibilidadDiaDto } from '@akyuam/shared'
import { diaSemanaCorto, numeroDia, textoSemana } from './fechas'

interface SelectorHorarioProps {
  disponibilidad: DisponibilidadDiaDto[]
  fecha: string | null
  hora: string | null
  onFecha: (fecha: string) => void
  onHora: (hora: string) => void
  etiquetaDia?: string
}

const SIGUIENTE = new Set(['ArrowRight', 'ArrowDown'])
const ANTERIOR = new Set(['ArrowLeft', 'ArrowUp'])

/**
 * Roving tabindex: la rejilla es una sola parada de Tab y las flechas (más Inicio y Fin) mueven el
 * foco entre sus botones habilitados. Enter o Espacio eligen, como en cualquier botón.
 */
function moverConFlechas(evento: KeyboardEvent<HTMLDivElement>) {
  const botones = [...evento.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
  const actual = botones.indexOf(document.activeElement as HTMLButtonElement)
  let destino: number | null = null
  if (SIGUIENTE.has(evento.key)) destino = Math.min(actual + 1, botones.length - 1)
  else if (ANTERIOR.has(evento.key)) destino = Math.max(actual - 1, 0)
  else if (evento.key === 'Home') destino = 0
  else if (evento.key === 'End') destino = botones.length - 1
  if (destino === null || actual === -1) return
  evento.preventDefault()
  for (const boton of botones) boton.tabIndex = -1
  botones[destino].tabIndex = 0
  botones[destino].focus()
}

/** El botón que recibe el Tab: el elegido o, si no hay, el primero habilitado. */
function indiceEnfocable<T>(opciones: T[], elegido: (opcion: T) => boolean, habilitado: (opcion: T) => boolean): number {
  const indice = opciones.findIndex((opcion) => elegido(opcion) && habilitado(opcion))
  return indice !== -1 ? indice : opciones.findIndex(habilitado)
}

/** Las horas antes del mediodía van en "Mañana"; el resto, en "Tarde". */
const MEDIODIA = '12:00'

/**
 * Elegir día y hora. Los días van por semana (lunes a viernes, con ‹ › para cambiar de semana)
 * y de cada día solo se ofrecen las horas libres, en mañana y tarde: las ocupadas no se muestran
 * (nunca se dice quién las ocupa). Solo presenta: la sugerencia inicial y el manejo de conflictos
 * viven en quien lo usa.
 */
export default function SelectorHorario({
  disponibilidad,
  fecha,
  hora,
  onFecha,
  onHora,
  etiquetaDia = 'Día',
}: SelectorHorarioProps) {
  const hoy = hoyGT()
  const dia = disponibilidad.find((uno) => uno.fecha === fecha)
  const rejillaDias = useRef<HTMLDivElement>(null)
  const yaEnfocado = useRef(false)
  const idDias = useId()
  const idHoras = useId()

  // Las semanas que toca la disponibilidad; se muestra la del día elegido.
  const semanas = [...new Set(disponibilidad.map((uno) => lunesDeSemanaGT(uno.fecha)))]
  const semana = fecha ? lunesDeSemanaGT(fecha) : semanas[0]
  const indiceSemana = semanas.indexOf(semana)
  const diasSemana = [0, 1, 2, 3, 4].map((desplazamiento) => {
    const propia = sumarDiasGT(semana, desplazamiento)
    return { fecha: propia, info: disponibilidad.find((uno) => uno.fecha === propia) }
  })

  // Al abrir la ventana, el foco arranca en el día sugerido (una sola vez).
  useEffect(() => {
    if (yaEnfocado.current || !fecha) return
    yaEnfocado.current = true
    rejillaDias.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
  }, [fecha])

  /** Cambiar de semana elige su primer día con horas libres (o el primero, si todos están llenos). */
  function irASemana(lunes: string) {
    const deEsa = disponibilidad.filter((uno) => lunesDeSemanaGT(uno.fecha) === lunes)
    const destino = deEsa.find((uno) => uno.libres.length > 0) ?? deEsa[0]
    if (destino) onFecha(destino.fecha)
  }

  const diaEnfocable = indiceEnfocable(
    diasSemana,
    (opcion) => opcion.fecha === fecha,
    (opcion) => opcion.info !== undefined,
  )
  const libres = dia?.libres ?? []
  const horaEnfocable = indiceEnfocable(libres, (opcion) => opcion === hora, () => true)
  const turnos = [
    { nombre: 'Mañana', horas: libres.filter((opcion) => opcion < MEDIODIA) },
    { nombre: 'Tarde', horas: libres.filter((opcion) => opcion >= MEDIODIA) },
  ].filter((turno) => turno.horas.length > 0)

  return (
    <div className="space-y-4">
      {/* Un grupo con su encabezado en una fila (y no un fieldset con legend): así la etiqueta y la
          navegación de semanas quedan alineadas y nunca encima de los días. */}
      <div role="group" aria-labelledby={idDias} className="min-w-0">
        <div className="mb-1.5 flex min-h-[28px] items-center justify-between gap-2">
          <span id={idDias} className="text-[13px] font-medium text-gray-900">
            {etiquetaDia}
          </span>
          {semanas.length > 1 && (
            <div className="flex items-center gap-0.5 text-[12.5px]">
              <button
                type="button"
                aria-label="Semana anterior"
                disabled={indiceSemana <= 0}
                onClick={() => irASemana(semanas[indiceSemana - 1])}
                className="rounded p-1 text-gray-500 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[150px] whitespace-nowrap text-center font-medium text-gray-900">{textoSemana(semana)}</span>
              <button
                type="button"
                aria-label="Semana siguiente"
                disabled={indiceSemana === -1 || indiceSemana >= semanas.length - 1}
                onClick={() => irASemana(semanas[indiceSemana + 1])}
                className="rounded p-1 text-gray-500 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        <div ref={rejillaDias} onKeyDown={moverConFlechas} className="grid grid-cols-5 gap-1.5">
          {diasSemana.map((opcion, indice) => {
            const elegido = opcion.fecha === fecha
            // Fuera de la ventana de disponibilidad: ya pasó o queda muy lejos para agendar.
            const fuera = opcion.info === undefined
            const lleno = !fuera && opcion.info!.libres.length === 0
            return (
              <button
                key={opcion.fecha}
                type="button"
                aria-pressed={elegido}
                disabled={fuera}
                tabIndex={indice === diaEnfocable ? 0 : -1}
                aria-label={`${formatFechaLargaGT(opcion.fecha)}: ${fuera ? 'no disponible' : lleno ? 'sin horas libres' : `${opcion.info!.libres.length} horas libres`}`}
                onClick={() => onFecha(opcion.fecha)}
                className={`min-w-0 rounded-lg border-[1.5px] px-1 py-1.5 text-center transition-colors ${
                  elegido
                    ? 'border-brand-600 bg-brand-50'
                    : fuera
                      ? 'cursor-not-allowed border-transparent bg-gray-50'
                      : lleno
                        ? 'border-gray-100 bg-gray-50 hover:border-brand-300'
                        : 'border-gray-200 bg-white hover:border-brand-300'
                }`}
              >
                <span className={`block text-[10.5px] font-semibold uppercase tracking-wide ${elegido ? 'text-brand-700' : 'text-gray-500'}`}>
                  {opcion.fecha === hoy ? 'Hoy' : diaSemanaCorto(opcion.fecha)}
                </span>
                <span className={`block text-base font-semibold ${fuera || lleno ? 'text-gray-400' : 'text-gray-900'}`}>
                  {numeroDia(opcion.fecha)}
                </span>
                <span className={`block truncate text-[10.5px] ${lleno ? 'text-red-700' : 'text-gray-500'}`}>
                  {fuera ? '—' : lleno ? 'Lleno' : `${opcion.info!.libres.length} libres`}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {dia && dia.libres.length === 0 ? (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          No quedan horas libres ese día. Elige otro día.
        </p>
      ) : (
        dia && (
          <div role="group" aria-labelledby={idHoras}>
            <span id={idHoras} className="mb-1.5 block text-[13px] font-medium text-gray-900">
              Hora
            </span>
            {/* Mañana y tarde comparten la misma rejilla: las columnas quedan alineadas entre los dos. */}
            <div onKeyDown={moverConFlechas} className="space-y-2.5">
              {turnos.map((turno) => (
                <div key={turno.nombre}>
                  <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-gray-500">
                    {turno.nombre}
                  </span>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-1.5">
                    {turno.horas.map((opcion) => {
                      const elegida = opcion === hora
                      return (
                        <button
                          key={opcion}
                          type="button"
                          aria-pressed={elegida}
                          tabIndex={libres.indexOf(opcion) === horaEnfocable ? 0 : -1}
                          onClick={() => onHora(opcion)}
                          className={`rounded-md border py-1.5 font-mono text-[12.5px] ${
                            elegida
                              ? 'border-brand-600 bg-brand-600 text-white'
                              : 'border-gray-300 bg-white text-gray-900 hover:border-brand-600'
                          }`}
                        >
                          {opcion}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}
