import { useEffect, useRef, type KeyboardEvent } from 'react'
import { HORARIO_MEDICINA, hoyGT, type DisponibilidadDiaDto } from '@akyuam/shared'
import { diaSemanaCorto, numeroDia } from './fechas'

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

/**
 * Días hábiles con sus horas libres y la rejilla de horas del día elegido. Solo presenta: la
 * sugerencia inicial y el manejo de conflictos viven en quien lo usa. Las horas ocupadas se ven
 * tachadas (nunca se dice quién las ocupa).
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
  const libres = new Set(dia?.libres ?? [])
  const rejillaDias = useRef<HTMLDivElement>(null)
  const yaEnfocado = useRef(false)

  // Al abrir la ventana, el foco arranca en el día sugerido (una sola vez).
  useEffect(() => {
    if (yaEnfocado.current || !fecha) return
    yaEnfocado.current = true
    rejillaDias.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
  }, [fecha])

  const diaEnfocable = indiceEnfocable(disponibilidad, (opcion) => opcion.fecha === fecha, () => true)
  const horaEnfocable = indiceEnfocable(
    [...HORARIO_MEDICINA.horas],
    (opcion) => opcion === hora,
    (opcion) => libres.has(opcion),
  )

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-[#1c2430]">{etiquetaDia}</legend>
        <div ref={rejillaDias} onKeyDown={moverConFlechas} className="grid grid-cols-[repeat(auto-fill,minmax(78px,1fr))] gap-2">
          {disponibilidad.map((opcion, indice) => {
            const elegido = opcion.fecha === fecha
            const lleno = opcion.libres.length === 0
            return (
              <button
                key={opcion.fecha}
                type="button"
                aria-pressed={elegido}
                tabIndex={indice === diaEnfocable ? 0 : -1}
                onClick={() => onFecha(opcion.fecha)}
                className={`rounded-lg border-[1.5px] px-2 py-2 text-center transition-colors ${
                  elegido
                    ? 'border-[#7346a5] bg-[#f2ecfa]'
                    : 'border-[#e3e6ea] bg-white hover:border-[#c7a8e5]'
                }`}
              >
                <span className={`block text-[10.5px] font-semibold uppercase tracking-wide ${elegido ? 'text-[#5b3985]' : 'text-[#5b6573]'}`}>
                  {opcion.fecha === hoy ? 'Hoy' : diaSemanaCorto(opcion.fecha)}
                </span>
                <span className="block text-lg font-semibold text-[#1c2430]">{numeroDia(opcion.fecha)}</span>
                <span className={`block text-[11px] ${lleno ? 'text-[#9b2c20]' : 'text-[#5b6573]'}`}>
                  {lleno ? 'Lleno' : `${opcion.libres.length} libres`}
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>

      {dia && dia.libres.length === 0 ? (
        <p role="status" className="rounded-lg border border-[#ecd9b8] bg-[#fbf1de] px-3 py-2 text-[13px] text-[#8a5a14]">
          No quedan horas libres ese día. Elige otro día.
        </p>
      ) : (
        dia && (
          <div role="group" aria-labelledby="titulo-horas-medica" aria-describedby="ayuda-horas-medica">
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <span id="titulo-horas-medica" className="text-[13px] font-medium text-[#1c2430]">
                Hora
              </span>
              <span id="ayuda-horas-medica" className="text-[11.5px] text-[#5b6573]">
                Las horas tachadas ya están ocupadas
              </span>
            </div>
            <div onKeyDown={moverConFlechas} className="grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-1.5">
              {HORARIO_MEDICINA.horas.map((opcion, indice) => {
                const libre = libres.has(opcion)
                const elegida = opcion === hora
                return (
                  <button
                    key={opcion}
                    type="button"
                    aria-pressed={elegida}
                    tabIndex={indice === horaEnfocable ? 0 : -1}
                    disabled={!libre}
                    aria-label={libre ? opcion : `${opcion}, ocupada`}
                    onClick={() => onHora(opcion)}
                    className={`rounded-md border px-2 py-1.5 font-mono text-[13px] ${
                      !libre
                        ? 'cursor-not-allowed border-transparent bg-[#f4f5f7] text-[#9aa4b0] line-through'
                        : elegida
                          ? 'border-[#7346a5] bg-[#7346a5] text-white'
                          : 'border-[#d5dadf] bg-white text-[#1c2430] hover:border-[#7346a5]'
                    }`}
                  >
                    {opcion}
                  </button>
                )
              })}
            </div>
          </div>
        )
      )}
    </div>
  )
}
