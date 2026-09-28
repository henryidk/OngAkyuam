import type { UseFormReturn } from 'react-hook-form'
import type { RegistroUsuariaNuevaFormValues } from '@akyuam/shared'
import { useAuthStore } from '../../../store/auth.store'

interface FranjaRegistroProps {
  form: UseFormReturn<RegistroUsuariaNuevaFormValues>
}

/** Encabeza el primer paso del wizard (sea "Usuaria" o, si ya existe, "Situación"). */
export default function FranjaRegistro({ form }: FranjaRegistroProps) {
  const {
    register,
    formState: { errors },
  } = form
  const nombreUsuario = useAuthStore((estado) => estado.usuario?.nombreCompleto)

  return (
    <div className="grid gap-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 sm:grid-cols-3">
      <div>
        <label htmlFor="datosCaso.fecha" className="block text-xs text-gray-500">
          Fecha de registro
        </label>
        <input
          id="datosCaso.fecha"
          type="date"
          className="mt-0.5 w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          {...register('datosCaso.fecha')}
        />
        {errors.datosCaso?.fecha?.message && (
          <p className="mt-1 text-xs text-red-600">{errors.datosCaso.fecha.message}</p>
        )}
      </div>
      <div>
        <p className="text-xs text-gray-500">Expediente</p>
        <p className="mt-1.5 text-sm font-medium text-gray-700">Se asigna al guardar</p>
      </div>
      <div>
        <p className="text-xs text-gray-500">Registra</p>
        <p className="mt-1.5 truncate text-sm font-medium text-gray-700">{nombreUsuario ?? '—'}</p>
      </div>
    </div>
  )
}
