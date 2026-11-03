import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Check, Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm, type UseFormRegisterReturn } from 'react-hook-form'
import { z } from 'zod'
import logo from '../assets/logo-akyuam.png'
import PanelMarca from '../components/auth/PanelMarca'
import LogoutButton from '../components/LogoutButton'
import { api } from '../lib/api'
import { extraerMensajeError } from '../lib/errors'
import { useAuthStore, type UsuarioAutenticado } from '../store/auth.store'

const MIN_CARACTERES = 8

const schema = z
  .object({
    passwordActual: z.string().min(1, 'Ingrese la contraseña temporal'),
    passwordNueva: z.string().min(MIN_CARACTERES, `Debe tener al menos ${MIN_CARACTERES} caracteres`),
    confirmarPassword: z.string().min(1, 'Confirme la nueva contraseña'),
  })
  .refine((datos) => datos.passwordNueva !== datos.passwordActual, {
    message: 'Debe ser distinta a la contraseña temporal',
    path: ['passwordNueva'],
  })
  .refine((datos) => datos.passwordNueva === datos.confirmarPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmarPassword'],
  })

type FormValues = z.infer<typeof schema>

export default function CambiarPassword() {
  const usuario = useAuthStore((state) => state.usuario)
  const setUsuario = useAuthStore((state) => state.setUsuario)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { passwordActual: '', passwordNueva: '', confirmarPassword: '' },
  })

  const [actual, nueva, confirmacion] = watch(['passwordActual', 'passwordNueva', 'confirmarPassword'])
  const requisitos = [
    { texto: `Al menos ${MIN_CARACTERES} caracteres`, cumple: nueva.length >= MIN_CARACTERES },
    { texto: 'Distinta a la contraseña temporal', cumple: nueva.length > 0 && nueva !== actual },
    { texto: 'Ambas contraseñas coinciden', cumple: confirmacion.length > 0 && nueva === confirmacion },
  ]

  async function onSubmit(datos: FormValues) {
    setError(null)
    try {
      const { data } = await api.post<{ usuario: UsuarioAutenticado }>('/auth/cambiar-password', {
        passwordActual: datos.passwordActual,
        passwordNueva: datos.passwordNueva,
      })
      setUsuario(data.usuario)
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }

  const primerNombre = usuario?.nombreCompleto.trim().split(/\s+/)[0]

  return (
    <div className="flex min-h-screen bg-white">
      <PanelMarca />

      <main className="relative flex flex-1 items-center justify-center bg-gradient-to-b from-brand-50 to-white px-6 py-12 lg:bg-none">
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <LogoutButton variante="enlace" />
        </div>

        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <img src={logo} alt="Centro Ak’ Yu’am" className="h-24 w-auto drop-shadow-sm" />
            <span className="mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 ring-8 ring-brand-50">
              <KeyRound className="h-6 w-6" />
            </span>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-gray-900">
              Crea tu contraseña
            </h1>
            <p className="mt-1.5 text-sm text-gray-500">
              {primerNombre ? `Hola, ${primerNombre}. ` : ''}
              Por seguridad, reemplaza la contraseña temporal por una personal antes de continuar.
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Campo oculto para que el gestor de contraseñas asocie la nueva clave a esta cuenta. */}
            {usuario && (
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={usuario.username}
                readOnly
                hidden
              />
            )}

            <CampoPassword
              id="passwordActual"
              etiqueta="Contraseña temporal"
              autoComplete="current-password"
              registro={register('passwordActual')}
              error={errors.passwordActual?.message}
              autoFocus
            />

            <div className="border-t border-gray-100" />

            <CampoPassword
              id="passwordNueva"
              etiqueta="Nueva contraseña"
              autoComplete="new-password"
              registro={register('passwordNueva')}
              error={errors.passwordNueva?.message}
            />
            <CampoPassword
              id="confirmarPassword"
              etiqueta="Confirmar nueva contraseña"
              autoComplete="new-password"
              registro={register('confirmarPassword')}
              error={errors.confirmarPassword?.message}
            />

            <ul aria-label="Requisitos de la contraseña" className="space-y-1.5 rounded-lg bg-gray-50 px-3.5 py-3">
              {requisitos.map((requisito) => (
                <li
                  key={requisito.texto}
                  className={`flex items-center gap-2 text-xs transition-colors ${
                    requisito.cumple ? 'text-green-700' : 'text-gray-500'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors ${
                      requisito.cumple ? 'bg-green-600 text-white' : 'border border-gray-300 bg-white'
                    }`}
                  >
                    {requisito.cumple && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  {requisito.texto}
                  <span className="sr-only">{requisito.cumple ? '(cumplido)' : '(pendiente)'}</span>
                </li>
              ))}
            </ul>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/30 transition hover:bg-brand-700 focus-visible:ring-4 focus-visible:ring-brand-200 active:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Guardando…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Guardar y continuar
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-400">
            No compartas tu contraseña con nadie, ni con el equipo de administración.
          </p>
        </div>
      </main>
    </div>
  )
}

interface CampoPasswordProps {
  id: string
  etiqueta: string
  autoComplete: 'current-password' | 'new-password'
  registro: UseFormRegisterReturn
  error?: string
  autoFocus?: boolean
}

function CampoPassword({ id, etiqueta, autoComplete, registro, error, autoFocus }: CampoPasswordProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700" htmlFor={id}>
        {etiqueta}
      </label>
      <div className="relative mt-1.5">
        <Lock
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
        />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`block w-full rounded-lg border bg-white py-2.5 pr-11 pl-10 text-sm text-gray-900 placeholder:text-gray-400 transition focus:outline-none focus:ring-4 ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
              : 'border-gray-300 focus:border-brand-500 focus:ring-brand-100'
          }`}
          {...registro}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

