import { useState } from 'react'
import type { CrearUsuarioResultado, UsuarioAdminDto } from '@akyuam/shared'
import { KeyRound, Pencil, UserCheck, UserX, type LucideIcon } from 'lucide-react'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'
import { useAuthStore } from '../../store/auth.store'

interface AccionesUsuarioProps {
  usuario: UsuarioAdminDto
  onEditar: () => void
  onCambio: (usuario: UsuarioAdminDto) => void
  onPasswordTemporal: (passwordTemporal: string) => void
}

type AccionAbierta = 'resetear' | 'desactivar' | 'activar' | null

export default function AccionesUsuario({
  usuario,
  onEditar,
  onCambio,
  onPasswordTemporal,
}: AccionesUsuarioProps) {
  const propioId = useAuthStore((state) => state.usuario?.id)
  const esPropiaCuenta = propioId === usuario.id

  const [accionAbierta, setAccionAbierta] = useState<AccionAbierta>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function cerrar() {
    setAccionAbierta(null)
    setError(null)
  }

  async function confirmarResetear() {
    setCargando(true)
    setError(null)
    try {
      const { data } = await api.patch<CrearUsuarioResultado>(
        `/administracion/usuarios/${usuario.id}/resetear-password`,
      )
      onCambio(data.usuario)
      onPasswordTemporal(data.passwordTemporal)
      cerrar()
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  async function confirmarCambiarEstado(activar: boolean) {
    setCargando(true)
    setError(null)
    try {
      const ruta = activar ? 'activar' : 'desactivar'
      const { data } = await api.patch<UsuarioAdminDto>(
        `/administracion/usuarios/${usuario.id}/${ruta}`,
      )
      onCambio(data)
      cerrar()
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 md:flex-nowrap md:justify-end md:gap-1">
      <BotonAccion Icono={Pencil} etiqueta="Editar" onClick={onEditar} />
      <BotonAccion
        Icono={KeyRound}
        etiqueta="Resetear contraseña"
        onClick={() => setAccionAbierta('resetear')}
        deshabilitadoPor={esPropiaCuenta ? 'No puedes resetear tu propia contraseña aquí' : undefined}
      />
      {usuario.isActive ? (
        <BotonAccion
          Icono={UserX}
          etiqueta="Desactivar"
          peligro
          onClick={() => setAccionAbierta('desactivar')}
          deshabilitadoPor={esPropiaCuenta ? 'No puedes desactivar tu propia cuenta' : undefined}
        />
      ) : (
        <BotonAccion Icono={UserCheck} etiqueta="Activar" exito onClick={() => setAccionAbierta('activar')} />
      )}

      <ConfirmModal
        abierto={accionAbierta === 'resetear'}
        titulo="Resetear contraseña"
        descripcion={`Se generará una contraseña temporal para ${usuario.nombreCompleto}. Deberá cambiarla en su próximo ingreso.`}
        confirmarLabel="Resetear"
        cargando={cargando}
        error={error}
        onConfirmar={confirmarResetear}
        onCancelar={cerrar}
      />

      <ConfirmModal
        abierto={accionAbierta === 'desactivar'}
        titulo="Desactivar usuario"
        descripcion={`${usuario.nombreCompleto} no podrá volver a iniciar sesión hasta que se reactive la cuenta. Si es psicóloga, sus casos y procesos abiertos pasarán al Área de atención de Psicología para que otra profesional los tome.`}
        confirmarLabel="Desactivar"
        peligro
        cargando={cargando}
        error={error}
        onConfirmar={() => confirmarCambiarEstado(false)}
        onCancelar={cerrar}
      />

      <ConfirmModal
        abierto={accionAbierta === 'activar'}
        titulo="Activar usuario"
        descripcion={`${usuario.nombreCompleto} podrá volver a iniciar sesión.`}
        confirmarLabel="Activar"
        cargando={cargando}
        error={error}
        onConfirmar={() => confirmarCambiarEstado(true)}
        onCancelar={cerrar}
      />
    </div>
  )
}

interface BotonAccionProps {
  Icono: LucideIcon
  etiqueta: string
  onClick: () => void
  peligro?: boolean
  exito?: boolean
  /** Motivo por el que la acción no está disponible; si viene, el botón se deshabilita y lo explica. */
  deshabilitadoPor?: string
}

/** Solo ícono en la tabla (con tooltip); con texto visible en las tarjetas de móvil. */
function BotonAccion({ Icono, etiqueta, onClick, peligro, exito, deshabilitadoPor }: BotonAccionProps) {
  const tono = peligro
    ? 'hover:border-red-200 hover:bg-red-50 hover:text-red-700'
    : exito
      ? 'hover:border-green-200 hover:bg-green-50 hover:text-green-700'
      : 'hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!deshabilitadoPor}
      title={deshabilitadoPor ?? etiqueta}
      aria-label={etiqueta}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors md:border-transparent md:bg-transparent md:p-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-transparent disabled:hover:bg-transparent disabled:hover:text-gray-600 ${tono}`}
    >
      <Icono className="h-4 w-4" />
      <span className="md:sr-only">{etiqueta}</span>
    </button>
  )
}
