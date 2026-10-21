import type { FormEventHandler, ReactNode } from 'react'
import type { PasoId, PasoWizard } from '../wizard'
import IndicadorPasos from './IndicadorPasos'
import IndicadorPasosVertical from './IndicadorPasosVertical'

interface MarcoWizardProps {
  pasos: PasoWizard[]
  pasoActualId: PasoId
  onIrAPaso: (id: PasoId) => void
  /** Encima del stepper lateral: el número de expediente, o que se asigna al registrar. */
  encabezadoLateral: ReactNode
  onSubmit: FormEventHandler<HTMLFormElement>
  /** Entre el encabezado del paso y su contenido (avisos, identidad de la usuaria). */
  avisos?: ReactNode
  pie: ReactNode
  children: ReactNode
}

/**
 * Mismo marco antes y después de registrar, para que referir y subir documentos se sientan
 * como la continuación del registro y no como otra pantalla.
 */
export default function MarcoWizard({
  pasos,
  pasoActualId,
  onIrAPaso,
  encabezadoLateral,
  onSubmit,
  avisos,
  pie,
  children,
}: MarcoWizardProps) {
  const indice = pasos.findIndex((paso) => paso.id === pasoActualId)
  const paso = pasos[indice]

  return (
    <div className="mx-auto max-w-6xl">
      <div className="lg:hidden">
        <IndicadorPasos pasos={pasos} pasoActualId={pasoActualId} onIrAPaso={onIrAPaso} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:mt-0 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <aside className="hidden lg:sticky lg:top-6 lg:block">
          <p className="mb-4 text-xs text-gray-500">{encabezadoLateral}</p>
          <IndicadorPasosVertical pasos={pasos} pasoActualId={pasoActualId} onIrAPaso={onIrAPaso} />
        </aside>

        <form onSubmit={onSubmit} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <header className="border-b border-gray-100 px-6 py-5">
            <p className="text-xs font-medium text-brand-600">
              Paso {indice + 1} de {pasos.length}
              {paso.fase === 'seguimiento' && ' · opcional'}
            </p>
            <h2 className="text-lg font-semibold text-gray-900">{paso.titulo}</h2>
            {paso.ayuda && <p className="text-[13px] text-gray-500">{paso.ayuda}</p>}
          </header>

          <div className="flex flex-col gap-5 p-6">
            {avisos}
            {children}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
            {pie}
          </div>
        </form>
      </div>
    </div>
  )
}
