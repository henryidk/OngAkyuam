import { useState } from 'react'
import type { CrearUsuarioResultado, UsuarioAdminDto } from '@akyuam/shared'
import Button from '../../components/ui/Button'
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
    <div className="flex items-center justify-end gap-2">
      <Button variante="secondary" onClick={onEditar}>
        Editar
      </Button>
      <Button
        variante="secondary"
        onClick={() => setAccionAbierta('resetear')}
        disabled={esPropiaCuenta}
        title={esPropiaCuenta ? 'No puedes resetear tu propia contraseña aquí' : undefined}
      >
        Resetear
      </Button>
      {usuario.isActive ? (
        <Button
          variante="danger"
          onClick={() => setAccionAbierta('desactivar')}
          disabled={esPropiaCuenta}
          title={esPropiaCuenta ? 'No puedes desactivar tu propia cuenta' : undefined}
        >
          Desactivar
        </Button>
      ) : (
        <Button variante="secondary" onClick={() => setAccionAbierta('activar')}>
          Activar
        </Button>
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
        descripcion={`${usuario.nombreCompleto} no podrá volver a iniciar sesión hasta que se reactive la cuenta.`}
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
