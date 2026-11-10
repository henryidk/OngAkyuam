import type { ReactNode, RefObject } from 'react'

/** Lo que pasa con la atención después de esta visita. Se elige siempre: no hay uno por defecto. */
export type TipoQueSigueConsulta = 'PROGRAMAR' | 'SIN_PROXIMA' | 'ALTA'

const OPCIONES: { tipo: TipoQueSigueConsulta; titulo: string; ayuda: string }[] = [
  { tipo: 'PROGRAMAR', titulo: 'Programar la próxima consulta', ayuda: 'Se agrega a la agenda al guardar.' },
  {
    tipo: 'SIN_PROXIMA',
    titulo: 'Sin próxima por ahora',
    ayuda: 'La atención sigue abierta y queda en Pacientes › Sin próxima consulta.',
  },
  { tipo: 'ALTA', titulo: 'Dar de alta', ayuda: 'Al guardar se abre el alta para que la confirmes.' },
]

interface QueSigueConsultaProps {
  valor: TipoQueSigueConsulta | null
  onElegir: (tipo: TipoQueSigueConsulta) => void
  /** Se intentó guardar sin elegir (o sin día y hora): el bloque lo marca. */
  error: string | null
  deshabilitado: boolean
  /** Para llevar el foco aquí cuando falta elegir. */
  primeraOpcion: RefObject<HTMLButtonElement | null>
  /** El día y la hora elegidos, debajo de las opciones cuando se programa. */
  children?: ReactNode
}

export default function QueSigueConsulta({
  valor,
  onElegir,
  error,
  deshabilitado,
  primeraOpcion,
  children,
}: QueSigueConsultaProps) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-xl border bg-white px-5 py-[18px] ${
        error ? 'border-estado-error-borde' : 'border-borde'
      }`}
    >
      <h2 id="que-sigue-consulta" className="text-sm font-semibold text-texto">
        ¿Qué sigue?
      </h2>
      <div
        role="radiogroup"
        aria-labelledby="que-sigue-consulta"
        aria-required="true"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'error-que-sigue-consulta' : undefined}
        className="grid gap-2 sm:grid-cols-3"
      >
        {OPCIONES.map((opcion, indice) => {
          const elegida = valor === opcion.tipo
          return (
            <button
              key={opcion.tipo}
              ref={indice === 0 ? primeraOpcion : undefined}
              type="button"
              role="radio"
              aria-checked={elegida}
              disabled={deshabilitado}
              onClick={() => onElegir(opcion.tipo)}
              className={`flex items-start gap-2.5 rounded-lg border-[1.5px] px-3 py-2.5 text-left text-texto disabled:opacity-60 ${
                elegida ? 'border-brand-600 bg-brand-50' : 'border-borde bg-white hover:border-brand-300'
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-px flex h-4 w-4 flex-none items-center justify-center rounded-full border-[1.5px] ${
                  elegida ? 'border-brand-600' : 'border-borde-fuerte'
                }`}
              >
                {elegida && <span className="h-2 w-2 rounded-full bg-brand-600" />}
              </span>
              <span className="flex flex-col gap-px">
                <span className="text-[13.5px] font-semibold">{opcion.titulo}</span>
                <span className="text-xs text-texto-suave">{opcion.ayuda}</span>
              </span>
            </button>
          )
        })}
      </div>
      {children}
      {error && (
        <p id="error-que-sigue-consulta" className="text-[13px] text-estado-error">
          {error}
        </p>
      )}
    </section>
  )
}
