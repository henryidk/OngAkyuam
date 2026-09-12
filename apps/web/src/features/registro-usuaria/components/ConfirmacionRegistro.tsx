import { formatFechaGT, type ExpedienteCreado } from '@akyuam/shared'

interface ConfirmacionRegistroProps {
  expediente: ExpedienteCreado
  onNuevoRegistro: () => void
}

export default function ConfirmacionRegistro({ expediente, onNuevoRegistro }: ConfirmacionRegistroProps) {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-brand-200 bg-brand-50 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-semibold text-brand-900">Usuaria guardada correctamente</h2>
      <p className="mt-2 text-sm text-brand-800">
        Expediente <span className="font-semibold">{expediente.numero}</span> — {expediente.usuariaNombreCompleto}
      </p>
      <p className="text-xs text-brand-700">Fecha del registro: {formatFechaGT(expediente.fecha)}</p>
      <button
        type="button"
        onClick={onNuevoRegistro}
        className="mt-6 rounded bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Registrar otra usuaria
      </button>
    </div>
  )
}
