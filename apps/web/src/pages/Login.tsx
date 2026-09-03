import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { extraerMensajeError } from '../lib/errors'
import { ROL_HOME } from '../lib/roles'
import { useAuthStore } from '../store/auth.store'

const schema = z.object({
  username: z.string().min(1, 'Requerido'),
  password: z.string().min(1, 'Requerida'),
})

type FormValues = z.infer<typeof schema>

// Coincide con el mensaje de LoginBloqueadoException del backend:
// "Demasiados intentos fallidos. Intente de nuevo en N segundos."
const REGEX_LOCKOUT = /en (\d+) segundos/

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (countdown <= 0) return
    const id = setInterval(() => {
      setCountdown((segundos) => {
        if (segundos <= 1) {
          setError(null)
          return 0
        }
        return segundos - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [countdown])

  async function onSubmit(datos: FormValues) {
    setError(null)
    try {
      const usuario = await login(datos.username, datos.password)
      navigate(ROL_HOME[usuario.rol], { replace: true })
    } catch (err) {
      const mensaje = extraerMensajeError(err)
      const match = REGEX_LOCKOUT.exec(mensaje)
      if (match) {
        setCountdown(Number(match[1]))
      }
      setError(mensaje)
    }
  }

  const bloqueado = countdown > 0

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded border bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold">AKyuam</h1>
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-sm font-medium" htmlFor="username">
              Usuario
            </label>
            <input
              id="username"
              className="mt-1 w-full rounded border px-3 py-2"
              autoComplete="username"
              {...register('username')}
            />
            {errors.username && (
              <p className="text-sm text-red-600">
                {errors.username.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              className="mt-1 w-full rounded border px-3 py-2"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-600">
              {error}
              {bloqueado && ` (${countdown}s)`}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting || bloqueado}
            className="w-full rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
          >
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
