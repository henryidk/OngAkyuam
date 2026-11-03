import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Eye, EyeOff, Lock, LogIn, ShieldCheck, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import logo from '../assets/logo-akyuam.png'
import { extraerMensajeError } from '../lib/errors'
import { ROL_HOME } from '../lib/roles'
import { useAuthStore } from '../store/auth.store'

const schema = z.object({
  username: z.string().min(1, 'Ingrese su usuario'),
  password: z.string().min(1, 'Ingrese su contraseña'),
})

type FormValues = z.infer<typeof schema>

// Coincide con el mensaje de LoginBloqueadoException del backend:
// "Demasiados intentos fallidos. Intente de nuevo en N segundos."
const REGEX_LOCKOUT = /en (\d+) segundos/

const AREAS = ['Trabajo social', 'Jurídica', 'Psicológica', 'Médica']

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [verPassword, setVerPassword] = useState(false)
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

  const claseInput = (conError: boolean) =>
    `block w-full rounded-lg border bg-white py-2.5 pl-10 text-sm text-gray-900 placeholder:text-gray-400 transition focus:outline-none focus:ring-4 ${
      conError
        ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
        : 'border-gray-300 focus:border-brand-500 focus:ring-brand-100'
    }`

  return (
    <div className="flex min-h-screen bg-white">
      {/* Panel de marca (solo pantallas grandes) */}
      <aside className="relative hidden w-[46%] overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* Formas decorativas suaves */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-brand-500/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-brand-400/20 blur-3xl"
        />
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]"
        >
          <defs>
            <pattern id="puntos" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#puntos)" />
        </svg>

        {/* Espaciador para mantener el bloque central centrado (justify-between) */}
        <div aria-hidden />

        <div className="relative max-w-md">
          <h2 className="text-white">
            <span className="block text-sm font-semibold uppercase tracking-[0.4em] text-brand-300">
              Centro
            </span>
            <span className="mt-2 block text-5xl font-bold tracking-tight xl:text-6xl">
              Ak’ Yu’am
            </span>
          </h2>
          <ul className="mt-8 flex flex-wrap gap-2">
            {AREAS.map((area) => (
              <li
                key={area}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-brand-100 backdrop-blur-sm"
              >
                {area}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-brand-100/80 backdrop-blur-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-300" />
          <p>
            La información de este sistema es confidencial. Todo acceso queda
            registrado.
          </p>
        </div>
      </aside>

      {/* Formulario */}
      <main className="relative flex flex-1 items-center justify-center bg-gradient-to-b from-brand-50 to-white px-6 py-12 lg:bg-none">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <img
              src={logo}
              alt="Centro Ak’ Yu’am"
              className="h-36 w-auto drop-shadow-sm sm:h-40"
            />
            <h1 className="mt-8 text-2xl font-semibold tracking-tight text-gray-900">
              Iniciar sesión
            </h1>
            <p className="mt-1.5 text-sm text-gray-500">
              Ingrese sus credenciales para continuar
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="username">
                Usuario
              </label>
              <div className="relative mt-1.5">
                <User
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                />
                <input
                  id="username"
                  className={`${claseInput(!!errors.username)} pr-3`}
                  autoComplete="username"
                  autoFocus
                  placeholder="nombre.usuario"
                  aria-invalid={!!errors.username}
                  aria-describedby={errors.username ? 'username-error' : undefined}
                  {...register('username')}
                />
              </div>
              {errors.username && (
                <p id="username-error" className="mt-1.5 text-xs text-red-600">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="password">
                Contraseña
              </label>
              <div className="relative mt-1.5">
                <Lock
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                />
                <input
                  id="password"
                  type={verPassword ? 'text' : 'password'}
                  className={`${claseInput(!!errors.password)} pr-11`}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={verPassword}
                >
                  {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1.5 text-xs text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {error}
                  {bloqueado && (
                    <span className="ml-1 font-semibold tabular-nums">({countdown}s)</span>
                  )}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || bloqueado}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition hover:bg-brand-700 focus-visible:ring-4 focus-visible:ring-brand-200 active:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Ingresando…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Ingresar
                </>
              )}
            </button>
          </form>

          <p className="mt-10 flex items-center justify-center gap-1.5 text-xs text-gray-400 lg:hidden">
            <ShieldCheck className="h-3.5 w-3.5" />
            Información confidencial · acceso registrado
          </p>
          <p className="mt-4 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} Centro Ak’ Yu’am
          </p>
        </div>
      </main>
    </div>
  )
}
