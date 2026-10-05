import type { AccionProceso } from '@akyuam/shared'

interface PanelCierreProps {
  acciones: AccionProceso[]
  onFinalizar: () => void
  onSuspender: () => void
  onAbandonar: () => void
}

const CLASE_OPCION = 'block w-full rounded-lg border border-gray-200 px-3 py-2.5 text-left hover:border-gray-300 hover:bg-gray-50'

/** Solo ofrece lo que la máquina de estados del backend permite ahora (`accionesDisponibles`). */
export default function PanelCierre({ acciones, onFinalizar, onSuspender, onAbandonar }: PanelCierreProps) {
  const opciones = [
    {
      accion: 'FINALIZAR' as const,
      titulo: 'Finalizar proceso',
      detalle: 'Convenio, sentencia, desistimiento u otra forma',
      alElegir: onFinalizar,
    },
    {
      accion: 'SUSPENDER' as const,
      titulo: 'Suspender temporalmente',
      detalle: 'Queda en pausa y puede retomarse',
      alElegir: onSuspender,
    },
    {
      accion: 'ABANDONAR' as const,
      titulo: 'Registrar abandono del caso',
      detalle: 'La usuaria dejó de dar seguimiento',
      alElegir: onAbandonar,
    },
  ].filter((opcion) => acciones.includes(opcion.accion))

  if (opciones.length === 0) return null

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,.04)]">
      <h3 className="text-sm font-semibold text-gray-900">Cerrar o pausar</h3>
      <div className="mt-3 space-y-2">
        {opciones.map((opcion) => (
          <button key={opcion.accion} type="button" onClick={opcion.alElegir} className={CLASE_OPCION}>
            <span className={`block text-sm font-medium ${opcion.accion === 'ABANDONAR' ? 'text-red-700' : 'text-gray-900'}`}>
              {opcion.titulo}
            </span>
            <span className="block text-xs text-gray-500">{opcion.detalle}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
