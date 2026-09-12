import { Check } from 'lucide-react'
import { calcularEstadoPasos, type PasoId, type PasoWizard } from '../wizard'

interface IndicadorPasosProps {
  pasos: PasoWizard[]
  pasoActualId: PasoId
  onIrAPaso: (id: PasoId) => void
}

export default function IndicadorPasos({ pasos, pasoActualId, onIrAPaso }: IndicadorPasosProps) {
  const estados = calcularEstadoPasos(pasos, pasoActualId)

  return (
    <ol className="flex flex-wrap items-center gap-2">
      {estados.map(({ paso, indice, completado, activo, alcanzable }) => (
        <li key={paso.id}>
          <button
            type="button"
            disabled={!alcanzable}
            onClick={() => onIrAPaso(paso.id)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activo
                ? 'bg-brand-600 text-white'
                : completado
                  ? 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                  : 'cursor-not-allowed bg-gray-100 text-gray-400'
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                activo ? 'bg-white text-brand-600' : completado ? 'bg-brand-600 text-white' : 'bg-gray-300 text-white'
              }`}
            >
              {completado ? <Check size={10} strokeWidth={3} /> : indice + 1}
            </span>
            {paso.titulo}
          </button>
        </li>
      ))}
    </ol>
  )
}
