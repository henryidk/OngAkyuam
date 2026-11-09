import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface PestanaVista<V extends string> {
  vista: V
  etiqueta: string
  /** Número junto al nombre; con 0 o sin valor no se muestra. */
  conteo?: number
}

interface PestanasVistaProps<V extends string> {
  /** Nombre del grupo para el lector de pantalla ("Secciones de consultas"). */
  etiqueta: string
  pestanas: readonly PestanaVista<V>[]
  activa: V
  onCambiar: (vista: V) => void
  /** Contenido de la pestaña activa. */
  children: ReactNode
}

/**
 * Pestañas de una página (Por registrar / Historial): `tablist` real, con flechas, Inicio y Fin
 * para moverse entre ellas (plan V5.2). El contador se ve como número y el lector de pantalla lo
 * oye separado del nombre: "Por registrar, 3 pendientes".
 */
export default function PestanasVista<V extends string>({
  etiqueta,
  pestanas,
  activa,
  onCambiar,
  children,
}: PestanasVistaProps<V>) {
  const botones = useRef<(HTMLButtonElement | null)[]>([])
  const idPestana = (vista: V) => `pestana-${vista}`
  const idPanel = `panel-${activa}`

  function onKeyDown(evento: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const ultimo = pestanas.length - 1
    const destino =
      evento.key === 'ArrowRight' ? (indice === ultimo ? 0 : indice + 1)
      : evento.key === 'ArrowLeft' ? (indice === 0 ? ultimo : indice - 1)
      : evento.key === 'Home' ? 0
      : evento.key === 'End' ? ultimo
      : null
    if (destino === null) return
    evento.preventDefault()
    onCambiar(pestanas[destino].vista)
    botones.current[destino]?.focus()
  }

  return (
    <>
      <div role="tablist" aria-label={etiqueta} className="flex gap-1 border-b border-borde">
        {pestanas.map((pestana, indice) => {
          const seleccionada = pestana.vista === activa
          const conteo = pestana.conteo ?? 0
          return (
            <button
              key={pestana.vista}
              ref={(boton) => {
                botones.current[indice] = boton
              }}
              id={idPestana(pestana.vista)}
              type="button"
              role="tab"
              aria-label={conteo > 0 ? `${pestana.etiqueta}, ${conteo} ${conteo === 1 ? 'pendiente' : 'pendientes'}` : undefined}
              aria-selected={seleccionada}
              aria-controls={seleccionada ? idPanel : undefined}
              tabIndex={seleccionada ? 0 : -1}
              onClick={() => onCambiar(pestana.vista)}
              onKeyDown={(evento) => onKeyDown(evento, indice)}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand-600 ${
                seleccionada ? 'border-brand-600 text-brand-700' : 'border-transparent text-texto-suave hover:text-texto'
              }`}
            >
              {pestana.etiqueta}
              {conteo > 0 && <span className="ml-1.5 tabular-nums text-texto-suave">{conteo}</span>}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id={idPanel} aria-labelledby={idPestana(activa)}>
        {children}
      </div>
    </>
  )
}
