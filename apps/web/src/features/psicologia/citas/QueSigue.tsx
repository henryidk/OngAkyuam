import {
  DURACIONES_CITA_PSICOLOGICA_MINUTOS,
  formatInstanteGT,
  sumarDiasGT,
  type CitaResumen,
  type SiguientePasoSesion,
} from '@akyuam/shared'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../../juridico/compartido/campos'

export interface EstadoQueSigue {
  tipo: SiguientePasoSesion['tipo']
  fecha: string
  hora: string
  duracion: (typeof DURACIONES_CITA_PSICOLOGICA_MINUTOS)[number]
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
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={CLASE_ETIQUETA}>
              Fecha
              <input
                type="date"
                value={valor.fecha}
                onChange={(evento) => onCambio({ ...valor, fecha: evento.target.value })}
                className={CLASE_CAMPO}
              />
            </label>
            <label className={CLASE_ETIQUETA}>
              Hora
              <input
                type="time"
                value={valor.hora}
                onChange={(evento) => onCambio({ ...valor, hora: evento.target.value })}
                className={CLASE_CAMPO}
              />
            </label>
            <label className={CLASE_ETIQUETA}>
              Duración
              <select
                value={valor.duracion}
                onChange={(evento) => {
                  const duracion = DURACIONES_CITA_PSICOLOGICA_MINUTOS.find(
                    (minutos) => minutos === Number(evento.target.value),
                  )
                  if (duracion) onCambio({ ...valor, duracion })
                }}
                className={CLASE_CAMPO}
              >
                {DURACIONES_CITA_PSICOLOGICA_MINUTOS.map((minutos) => (
                  <option key={minutos} value={minutos}>
                    {minutos} minutos
                  </option>
                ))}
              </select>
            </label>
          </div>

          {conflicto && (
            <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="font-medium">Ya tienes una cita a esa hora:</p>
              <ul className="mt-1 list-disc pl-4">
                {conflicto.map((cita) => (
                  <li key={cita.id}>
                    {formatInstanteGT(cita.fechaHora)} · {cita.duracionMinutos} min
                  </li>
                ))}
              </ul>
              <p className="mt-1">Cambia la hora o guarda de nuevo si es intencional. Todavía no se guardó nada.</p>
            </div>
          )}
        </div>
      )}
    </fieldset>
  )
}
