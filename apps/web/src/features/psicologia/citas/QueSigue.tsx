import { sumarDiasGT, type CitaResumen, type DuracionCitaPsicologica, type SiguientePasoSesion } from '@akyuam/shared'
import AvisoTraslape from './AvisoTraslape'
import ElegirHorario from './ElegirHorario'

export interface EstadoQueSigue {
  tipo: SiguientePasoSesion['tipo']
  fecha: string
  hora: string
  duracion: DuracionCitaPsicologica
}

interface QueSigueProps {
  valor: EstadoQueSigue
  onCambio: (valor: EstadoQueSigue) => void
  /** Día (`YYYY-MM-DD`) desde el que se cuentan los atajos de "en 1 / 2 semanas". */
  diaBase: string
  /** Citas con las que choca la fecha elegida, según el servidor. */
  conflicto: CitaResumen[] | null
}

const OPCIONES: { tipo: EstadoQueSigue['tipo']; titulo: string; ayuda: string }[] = [
  { tipo: 'PROGRAMAR', titulo: 'Programar la próxima cita', ayuda: 'Queda en tu agenda al guardar.' },
  { tipo: 'NINGUNA', titulo: 'Decidir después', ayuda: 'El proceso sigue abierto y aparece en "Sin próxima cita".' },
  { tipo: 'CERRAR', titulo: 'Cerrar el proceso', ayuda: 'Al guardar se abre el cierre para que lo confirmes.' },
]

const ATAJOS = [
  { etiqueta: 'En 1 semana', dias: 7 },
  { etiqueta: 'En 2 semanas', dias: 14 },
]

/** Lo que pasa con el proceso después de esta sesión. Nunca cierra nada por sí solo. */
export default function QueSigue({ valor, onCambio, diaBase, conflicto }: QueSigueProps) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-gray-800">¿Qué sigue?</legend>

      <div className="grid gap-2 sm:grid-cols-3">
        {OPCIONES.map((opcion) => {
          const elegida = valor.tipo === opcion.tipo
          return (
            <label
              key={opcion.tipo}
              className={`cursor-pointer rounded-lg border px-3 py-2.5 focus-within:ring-2 focus-within:ring-brand-500 ${
                elegida ? 'border-brand-600 bg-brand-50' : 'border-gray-300 bg-white hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="que-sigue"
                className="sr-only"
                checked={elegida}
                onChange={() => onCambio({ ...valor, tipo: opcion.tipo })}
              />
              <span className="block text-sm font-medium text-gray-900">{opcion.titulo}</span>
              <span className="mt-0.5 block text-xs text-gray-600">{opcion.ayuda}</span>
            </label>
          )
        })}
      </div>

      {valor.tipo === 'PROGRAMAR' && (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
          <div className="flex flex-wrap gap-2">
            {ATAJOS.map((atajo) => {
              const fecha = sumarDiasGT(diaBase, atajo.dias)
              const elegido = valor.fecha === fecha
              return (
                <button
                  key={atajo.dias}
                  type="button"
                  aria-pressed={elegido}
                  onClick={() => onCambio({ ...valor, fecha })}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                    elegido
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {atajo.etiqueta}
                </button>
              )
            })}
          </div>
          <ElegirHorario
            fecha={valor.fecha}
            hora={valor.hora}
            duracion={valor.duracion}
            onDuracion={(duracion) => onCambio({ ...valor, duracion })}
            onCambio={(horario) => onCambio({ ...valor, ...horario })}
          />

          {conflicto && (
            <AvisoTraslape
              citas={conflicto}
              accion="Cambia la hora o guarda de nuevo si es intencional. Todavía no se guardó nada."
            />
          )}
        </div>
      )}
    </fieldset>
  )
}
