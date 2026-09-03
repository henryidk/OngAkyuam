import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import LogoutButton from '../components/LogoutButton'
import { api } from '../lib/api'
import { extraerMensajeError } from '../lib/errors'
import { useAuthStore, type UsuarioAutenticado } from '../store/auth.store'

const schema = z
  .object({
    passwordActual: z.string().min(1, 'Requerida'),
    passwordNueva: z.string().min(8, 'Debe tener al menos 8 caracteres'),
    confirmarPassword: z.string().min(1, 'Requerida'),
  })
  .refine((datos) => datos.passwordNueva === datos.confirmarPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmarPassword'],
  })

type FormValues = z.infer<typeof schema>

export default function CambiarPassword() {
  const setUsuario = useAuthStore((state) => state.setUsuario)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(datos: FormValues) {
    setError(null)
    try {
      const { data } = await api.post<{ usuario: UsuarioAutenticado }>(
        '/auth/cambiar-password',
        {
          passwordActual: datos.passwordActual,
          passwordNueva: datos.passwordNueva,
        },
      )
      setUsuario(data.usuario)
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded border bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Cambiar contraseña</h1>
          <LogoutButton />
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Debe establecer una nueva contraseña antes de continuar.
        </p>
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label
              className="block text-sm font-medium"
              htmlFor="passwordActual"
            >
              Contraseña actual
            </label>
            <input
              id="passwordActual"
              type="password"
              className="mt-1 w-full rounded border px-3 py-2"
              autoComplete="current-password"
              {...register('passwordActual')}
            />
            {errors.passwordActual && (
              <p className="text-sm text-red-600">
                {errors.passwordActual.message}
              </p>
            )}
          </div>
          <div>
            <label
              className="block text-sm font-medium"
              htmlFor="passwordNueva"
            >
              Nueva contraseña
            </label>
            <input
              id="passwordNueva"
              type="password"
              className="mt-1 w-full rounded border px-3 py-2"
              autoComplete="new-password"
              {...register('passwordNueva')}
            />
            {errors.passwordNueva && (
              <p className="text-sm text-red-600">
                {errors.passwordNueva.message}
              </p>
            )}
          </div>
          <div>
            <label
              className="block text-sm font-medium"
              htmlFor="confirmarPassword"
            >
              Confirmar nueva contraseña
            </label>
            <input
              id="confirmarPassword"
              type="password"
              className="mt-1 w-full rounded border px-3 py-2"
              autoComplete="new-password"
              {...register('confirmarPassword')}
            />
            {errors.confirmarPassword && (
              <p className="text-sm text-red-600">
                {errors.confirmarPassword.message}
              </p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
