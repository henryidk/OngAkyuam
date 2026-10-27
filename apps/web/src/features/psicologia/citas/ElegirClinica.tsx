import { useId } from 'react'
import { CLINICAS_PSICOLOGIA, ETIQUETAS_CLINICA_PSICOLOGIA, type ClinicaPsicologia } from '@akyuam/shared'

interface ElegirClinicaProps {
  valor: ClinicaPsicologia | null
  onCambio: (clinica: ClinicaPsicologia) => void
  error?: string
}

/** Dónde se atendió la sesión: dos botones grandes, uno por clínica. Obligatoria al guardar. */
export default function ElegirClinica({ valor, onCambio, error }: ElegirClinicaProps) {
  const idEtiqueta = useId()
  const idError = useId()
  return (
    <div className="space-y-2">
      <span id={idEtiqueta} className="block text-sm font-semibold text-gray-800">
        Clínica
        <span aria-hidden="true" className="ml-0.5 text-red-600">
          *
        </span>
      </span>
      <div
        role="radiogroup"
        aria-labelledby={idEtiqueta}
        aria-required="true"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? idError : undefined}
        className="grid grid-cols-2 gap-2"
      >
        {CLINICAS_PSICOLOGIA.map((clinica) => {
          const elegida = valor === clinica
          return (
            <button
              key={clinica}
              type="button"
              role="radio"
              aria-checked={elegida}
              onClick={() => onCambio(clinica)}
              className={`min-w-28 rounded-md border px-4 py-2 text-sm font-medium ${
                elegida
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : `bg-white text-gray-700 hover:bg-gray-50 ${error ? 'border-red-600' : 'border-gray-300'}`
              }`}
            >
              {ETIQUETAS_CLINICA_PSICOLOGIA[clinica]}
            </button>
          )
        })}
      </div>
      {error && (
        <p id={idError} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
