import { Check } from 'lucide-react'
import { calcularEstadoPasos, type PasoId, type PasoWizard } from '../wizard'

interface IndicadorPasosVerticalProps {
  pasos: PasoWizard[]
  pasoActualId: PasoId
  onIrAPaso: (id: PasoId) => void
}

export default function IndicadorPasosVertical({ pasos, pasoActualId, onIrAPaso }: IndicadorPasosVerticalProps) {
  const estados = calcularEstadoPasos(pasos, pasoActualId)

  return (
    <ol className="flex flex-col gap-1">
      {estados.map(({ paso, indice, completado, activo, alcanzable }) => (
        <li key={paso.id}>
          <button
            type="button"
            disabled={!alcanzable}
            onClick={() => onIrAPaso(paso.id)}
            className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
              activo ? 'bg-brand-50' : alcanzable ? 'hover:bg-gray-50' : 'cursor-not-allowed opacity-50'
            }`}
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                activo
                  ? 'bg-brand-600 text-white'
                  : completado
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {completado ? <Check size={13} strokeWidth={3} /> : indice + 1}
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-medium ${activo ? 'text-brand-900' : 'text-gray-700'}`}>
                {paso.titulo}
              </span>
              <span className="block text-xs text-gray-500">{paso.descripcion}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}
