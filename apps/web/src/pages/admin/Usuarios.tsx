import { useEffect, useState } from 'react'
import { UserPlus, Users as UsersIcon } from 'lucide-react'
import {
  ETIQUETAS_PUESTO,
  ETIQUETAS_ROL_CON_LOGIN,
  ROLES_CON_LOGIN_ADMINISTRABLES,
  type RolConLogin,
  type UsuarioAdminDto,
} from '@akyuam/shared'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Drawer from '../../components/ui/Drawer'
import EmptyState from '../../components/ui/EmptyState'
import AccionesUsuario from '../../features/administracion/AccionesUsuario'
import FormularioUsuario from '../../features/administracion/FormularioUsuario'
import ModalPasswordTemporal from '../../features/administracion/ModalPasswordTemporal'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'

const OPCIONES_FILTRO = [
  { value: '', label: 'Todas las áreas' },
  ...ROLES_CON_LOGIN_ADMINISTRABLES.map((rol) => ({ value: rol, label: ETIQUETAS_ROL_CON_LOGIN[rol] })),
]

type PanelDrawer = { modo: 'crear' } | { modo: 'editar'; usuario: UsuarioAdminDto } | null

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdminDto[]>([])
  const [filtroRol, setFiltroRol] = useState<RolConLogin | ''>('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<PanelDrawer>(null)
  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const { data } = await api.get<UsuarioAdminDto[]>('/administracion/usuarios', {
        params: filtroRol ? { rol: filtroRol } : undefined,
      })
      setUsuarios(data)
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroRol])

  function actualizarUsuarioEnLista(usuario: UsuarioAdminDto) {
    setUsuarios((actual) => actual.map((u) => (u.id === usuario.id ? usuario : u)))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={filtroRol}
          onChange={(event) => setFiltroRol(event.target.value as RolConLogin | '')}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {OPCIONES_FILTRO.map((opcion) => (
            <option key={opcion.value} value={opcion.value}>
              {opcion.label}
            </option>
          ))}
        </select>

        <Button onClick={() => setDrawer({ modo: 'crear' })}>
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!cargando && usuarios.length === 0 ? (
        <EmptyState
          Icono={UsersIcon}
          titulo="Sin usuarios registrados"
          descripcion="Crea la primera cuenta de acceso para esta área."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Área</th>
                <th className="px-4 py-3 font-medium">Puesto</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {usuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td className="px-4 py-3 text-gray-800">{usuario.nombreCompleto}</td>
                  <td className="px-4 py-3 text-gray-600">{usuario.username}</td>
                  <td className="px-4 py-3 text-gray-600">{ETIQUETAS_ROL_CON_LOGIN[usuario.rol]}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {usuario.puesto ? ETIQUETAS_PUESTO[usuario.puesto] ?? usuario.puesto : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tono={usuario.isActive ? 'success' : 'neutral'}>
                      {usuario.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <AccionesUsuario
                      usuario={usuario}
                      onEditar={() => setDrawer({ modo: 'editar', usuario })}
                      onCambio={actualizarUsuarioEnLista}
                      onPasswordTemporal={setPasswordTemporal}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        abierto={drawer !== null}
        titulo={drawer?.modo === 'editar' ? 'Editar usuario' : 'Nuevo usuario'}
        onCerrar={() => setDrawer(null)}
      >
        {drawer && (
          <FormularioUsuario
            usuario={drawer.modo === 'editar' ? drawer.usuario : undefined}
            onCreado={(resultado) => {
              setUsuarios((actual) => [...actual, resultado.usuario])
              setPasswordTemporal(resultado.passwordTemporal)
              setDrawer(null)
            }}
            onEditado={(usuario) => {
              actualizarUsuarioEnLista(usuario)
              setDrawer(null)
            }}
            onCancelar={() => setDrawer(null)}
          />
        )}
      </Drawer>

      {passwordTemporal && (
        <ModalPasswordTemporal
          passwordTemporal={passwordTemporal}
          onCerrar={() => setPasswordTemporal(null)}
        />
      )}
    </div>
  )
}
