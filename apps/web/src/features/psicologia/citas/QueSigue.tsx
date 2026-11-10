import type { RefObject } from 'react'
import type { CitaResumen, DuracionCitaPsicologica, SiguientePasoSesion } from '@akyuam/shared'
import AvisoTraslape from './AvisoTraslape'
import TextoHorario from './TextoHorario'

export interface EstadoQueSigue {
  /** null = todavía no se elige: nada viene marcado. */
  tipo: SiguientePasoSesion['tipo'] | null
  /** `YYYY-MM-DD`; vacío mientras no se elige en el modal de la próxima cita. */
  fecha: string
  hora: string
  duracion: DuracionCitaPsicologica
}

interface QueSigueProps {
  valor: EstadoQueSigue
  onElegir: (tipo: SiguientePasoSesion['tipo']) => void
  /** Abre el modal de la próxima cita (elegir o cambiar el día y la hora). */
  onElegirHorario: () => void
  /** Citas con las que choca la fecha elegida, según el servidor. */
  conflicto: CitaResumen[] | null
  /** Se intentó registrar sin elegir (o sin día y hora): el bloque lo marca. */
  error?: string | null
  deshabilitado?: boolean
  /** Para llevar el foco aquí cuando falta elegir. */
  primeraOpcion?: RefObject<HTMLInputElement | null>
}

const OPCIONES: { tipo: SiguientePasoSesion['tipo']; titulo: string; ayuda: string }[] = [
  { tipo: 'PROGRAMAR', titulo: 'Programar la próxima cita', ayuda: 'Queda en tu agenda al guardar.' },
  { tipo: 'NINGUNA', titulo: 'Decidir después', ayuda: 'El proceso sigue abierto y aparece en "Sin próxima cita".' },
  { tipo: 'CERRAR', titulo: 'Cerrar el proceso', ayuda: 'Al guardar se abre el cierre para que lo confirmes.' },
]

/** Lo que pasa con el proceso después de esta sesión. Nunca cierra nada por sí solo. */
export default function QueSigue({
  valor,
  onElegir,
  onElegirHorario,
  conflicto,
  error,
  deshabilitado = false,
  primeraOpcion,
}: QueSigueProps) {
  const conHorario = valor.fecha !== '' && valor.hora !== ''
  return (
    <fieldset
      className="space-y-3"
      disabled={deshabilitado}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? 'error-que-sigue' : undefined}
    >
      <legend className="text-sm font-semibold text-gray-800">¿Qué sigue?</legend>

      <div className="grid gap-2 sm:grid-cols-3">
        {OPCIONES.map((opcion, indice) => {
          const elegida = valor.tipo === opcion.tipo
          return (
            <label
              key={opcion.tipo}
              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border-[1.5px] px-3 py-2.5 focus-within:ring-2 focus-within:ring-brand-500 ${
                elegida
                  ? 'border-brand-600 bg-brand-50'
                  : `${error ? 'border-red-300' : 'border-gray-300'} bg-white hover:border-brand-300`
              }`}
            >
              <input
                ref={indice === 0 ? primeraOpcion : undefined}
                type="radio"
                name="que-sigue"
                className="sr-only"
                checked={elegida}
                onChange={() => onElegir(opcion.tipo)}
              />
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border-[1.5px] ${
                  elegida ? 'border-brand-600' : 'border-gray-400'
                }`}
              >
                {elegida && <span className="h-2 w-2 rounded-full bg-brand-600" />}
              </span>
              <span>
                <span className="block text-sm font-medium text-gray-900">{opcion.titulo}</span>
                <span className="mt-0.5 block text-xs text-gray-600">{opcion.ayuda}</span>
              </span>
            </label>
          )
        })}
      </div>

      {valor.tipo === 'PROGRAMAR' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          {conHorario ? (
            <p className="min-w-0 text-[13.5px] text-gray-900">
              <TextoHorario fecha={valor.fecha} hora={valor.hora} duracion={valor.duracion} />
            </p>
          ) : (
            <p className="text-[13px] text-gray-600">Falta elegir el día y la hora.</p>
          )}
          <button
            type="button"
            onClick={onElegirHorario}
            className="flex-none rounded-md border border-gray-300 bg-white px-3.5 py-2 text-[13px] font-semibold text-brand-700 hover:bg-brand-50"
          >
            {conHorario ? 'Cambiar' : 'Elegir día y hora'}
          </button>
        </div>
      )}

      {valor.tipo === 'PROGRAMAR' && conflicto && (
        <AvisoTraslape
          citas={conflicto}
          accion="Cambia la hora, o registra de nuevo si es intencional. Todavía no se guardó nada."
        />
      )}

      {error && (
        <p id="error-que-sigue" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  )
}
