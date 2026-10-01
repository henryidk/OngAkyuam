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
    <ol className="flex flex-col">
      {estados.map(({ paso, indice, completado, activo, alcanzable }) => (
        <li key={paso.id}>
          <button
            type="button"
            disabled={!alcanzable}
            onClick={() => onIrAPaso(paso.id)}
            aria-current={activo ? 'step' : undefined}
            className={`flex w-full gap-3 text-left ${alcanzable && !activo ? 'group' : 'cursor-default'}`}
          >
            <span className="flex flex-col items-center">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                  completado
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : activo
                      ? 'border-brand-600 bg-white text-brand-600'
                      : 'border-gray-300 bg-white text-gray-400'
                }`}
              >
                {completado ? <Check size={14} strokeWidth={3} /> : indice + 1}
              </span>
              {indice < estados.length - 1 && (
                <span className={`h-[26px] w-0.5 ${completado ? 'bg-brand-600' : 'bg-gray-200'}`} />
              )}
            </span>
            <span className="min-w-0 pt-1">
              <span
                className={`block text-sm group-hover:underline ${
                  activo ? 'font-semibold text-gray-900' : 'font-medium text-gray-500'
                }`}
              >
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
