import { useEffect, useMemo, useState } from 'react'
import { KeyRound, Search, UserCog, ShieldCheck, UserCheck, UserPlus, UserX, Users as UsersIcon, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  ETIQUETAS_PUESTO,
  ETIQUETAS_SEDE,
  ETIQUETAS_ROL_CON_LOGIN,
  ROLES_CON_LOGIN_ADMINISTRABLES,
  type RolConLogin,
  type UsuarioAdminDto,
} from '@akyuam/shared'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import AccionesUsuario from '../../features/administracion/AccionesUsuario'
import FormularioUsuario from '../../features/administracion/FormularioUsuario'
import ModalPasswordTemporal from '../../features/administracion/ModalPasswordTemporal'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'

const OPCIONES_FILTRO: { value: RolConLogin | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  ...ROLES_CON_LOGIN_ADMINISTRABLES.map((rol) => ({ value: rol, label: ETIQUETAS_ROL_CON_LOGIN[rol] })),
]

/** Color de identificación por área: mismo tono en el avatar y en la etiqueta del área. */
const COLOR_ROL: Record<RolConLogin, { avatar: string; etiqueta: string }> = {
  TRABAJO_SOCIAL: { avatar: 'bg-brand-100 text-brand-700', etiqueta: 'bg-brand-50 text-brand-700 ring-brand-200' },
  JURIDICO: { avatar: 'bg-sky-100 text-sky-700', etiqueta: 'bg-sky-50 text-sky-700 ring-sky-200' },
  PSICOLOGIA: { avatar: 'bg-teal-100 text-teal-700', etiqueta: 'bg-teal-50 text-teal-700 ring-teal-200' },
  MEDICA: { avatar: 'bg-rose-100 text-rose-700', etiqueta: 'bg-rose-50 text-rose-700 ring-rose-200' },
  ADMINISTRACION: { avatar: 'bg-slate-200 text-slate-700', etiqueta: 'bg-slate-100 text-slate-700 ring-slate-300' },
}

type PanelFormulario = { modo: 'crear' } | { modo: 'editar'; usuario: UsuarioAdminDto } | null

function obtenerIniciales(nombreCompleto: string) {
  const partes = nombreCompleto.trim().split(/\s+/)
  const primera = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primera + ultima).toUpperCase()
}

/** Comparación sin tildes ni mayúsculas, para que "maria" encuentre "María". */
function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdminDto[]>([])
  const [filtroRol, setFiltroRol] = useState<RolConLogin | ''>('')
  // Filtro local sobre la lista ya cargada: vive solo en el estado, nunca en la URL.
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<PanelFormulario>(null)
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

  const resumen = useMemo(() => {
    const activos = usuarios.filter((u) => u.isActive).length
    return {
      total: usuarios.length,
      activos,
      inactivos: usuarios.length - activos,
      pendientesPassword: usuarios.filter((u) => u.isActive && u.mustChangePassword).length,
    }
  }, [usuarios])

  const usuariosVisibles = useMemo(() => {
    const termino = normalizar(busqueda.trim())
    if (!termino) return usuarios
    return usuarios.filter(
      (u) => normalizar(u.nombreCompleto).includes(termino) || normalizar(u.username).includes(termino),
    )
  }, [usuarios, busqueda])

  const editar = (usuario: UsuarioAdminDto) => setFormulario({ modo: 'editar', usuario })

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Cuentas del personal</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Crea cuentas, restablece contraseñas y controla quién puede ingresar al sistema.
          </p>
        </div>
        <Button tamano="md" onClick={() => setFormulario({ modo: 'crear' })} className="shadow-sm">
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      {/* Resumen */}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaResumen Icono={UsersIcon} etiqueta="Cuentas" valor={resumen.total} tono="brand" cargando={cargando} />
        <TarjetaResumen Icono={UserCheck} etiqueta="Activas" valor={resumen.activos} tono="green" cargando={cargando} />
        <TarjetaResumen Icono={UserX} etiqueta="Inactivas" valor={resumen.inactivos} tono="gray" cargando={cargando} />
        <TarjetaResumen
          Icono={KeyRound}
          etiqueta="Deben cambiar contraseña"
          valor={resumen.pendientesPassword}
          tono="amber"
          cargando={cargando}
        />
      </dl>

      {/* Lista */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label="Filtrar por área" className="flex flex-wrap gap-1.5">
            {OPCIONES_FILTRO.map((opcion) => {
              const activo = filtroRol === opcion.value
              return (
                <button
                  key={opcion.value || 'todas'}
                  type="button"
                  role="tab"
                  aria-selected={activo}
                  onClick={() => setFiltroRol(opcion.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    activo
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                  }`}
                >
                  {opcion.label}
                </button>
              )
            })}
          </div>

          <div className="relative w-full lg:w-72">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o usuario"
              aria-label="Buscar por nombre o usuario"
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-9 pl-9 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                aria-label="Limpiar búsqueda"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {cargando ? (
          <FilasCargando />
        ) : usuarios.length === 0 ? (
          <div className="p-6">
            <EmptyState
              Icono={UsersIcon}
              titulo="Sin usuarios registrados"
              descripcion="Crea la primera cuenta de acceso para esta área."
              accion={
                <Button onClick={() => setFormulario({ modo: 'crear' })}>
                  <UserPlus className="h-4 w-4" />
                  Nuevo usuario
                </Button>
              }
            />
          </div>
        ) : usuariosVisibles.length === 0 ? (
          <div className="p-6">
            <EmptyState
              Icono={Search}
              titulo="Sin coincidencias"
              descripcion="Ninguna cuenta coincide con la búsqueda."
              accion={
                <Button variante="secondary" onClick={() => setBusqueda('')}>
                  Limpiar búsqueda
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {/* Tabla (pantallas medianas en adelante) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/80 text-xs font-medium tracking-wide text-gray-500 uppercase">
                  <tr>
                    <th className="px-5 py-3 font-medium">Persona</th>
                    <th className="px-4 py-3 font-medium">Área</th>
                    <th className="px-4 py-3 font-medium">Puesto</th>
                    <th className="px-4 py-3 font-medium">Sede</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3 text-right font-medium">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {usuariosVisibles.map((usuario) => (
                    <tr
                      key={usuario.id}
                      className={`transition-colors hover:bg-brand-50/40 ${usuario.isActive ? '' : 'bg-gray-50/60'}`}
                    >
                      <td className="px-5 py-3">
                        <Persona usuario={usuario} />
                      </td>
                      <td className="px-4 py-3">
                        <EtiquetaArea rol={usuario.rol} />
                      </td>
                      <td className="px-4 py-3 text-gray-600">{textoPuesto(usuario)}</td>
                      <td className="px-4 py-3 text-gray-600">{ETIQUETAS_SEDE[usuario.sede]}</td>
                      <td className="px-4 py-3">
                        <Estado usuario={usuario} />
                      </td>
                      <td className="px-5 py-3">
                        <AccionesUsuario
                          usuario={usuario}
                          onEditar={() => editar(usuario)}
                          onCambio={actualizarUsuarioEnLista}
                          onPasswordTemporal={setPasswordTemporal}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tarjetas (móvil) */}
            <ul className="divide-y divide-gray-100 md:hidden">
              {usuariosVisibles.map((usuario) => (
                <li key={usuario.id} className={`space-y-3 p-4 ${usuario.isActive ? '' : 'bg-gray-50/60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <Persona usuario={usuario} />
                    <Estado usuario={usuario} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-500">
                    <EtiquetaArea rol={usuario.rol} />
                    <span>{textoPuesto(usuario)}</span>
                    <span aria-hidden>·</span>
                    <span>{ETIQUETAS_SEDE[usuario.sede]}</span>
                  </div>
                  <AccionesUsuario
                    usuario={usuario}
                    onEditar={() => editar(usuario)}
                    onCambio={actualizarUsuarioEnLista}
                    onPasswordTemporal={setPasswordTemporal}
                  />
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
              {busqueda
                ? `${usuariosVisibles.length} de ${usuarios.length} cuentas`
                : `${usuarios.length} ${usuarios.length === 1 ? 'cuenta' : 'cuentas'}`}
            </div>
          </>
        )}
      </section>

      <Modal
        abierto={formulario !== null}
        titulo={formulario?.modo === 'editar' ? 'Editar usuario' : 'Nuevo usuario'}
        descripcion={
          formulario?.modo === 'editar'
            ? `@${formulario.usuario.username}`
            : 'Crea una cuenta de acceso para un miembro del personal.'
        }
        Icono={formulario?.modo === 'editar' ? UserCog : UserPlus}
        onCerrar={() => setFormulario(null)}
      >
        {formulario && (
          <FormularioUsuario
            usuario={formulario.modo === 'editar' ? formulario.usuario : undefined}
            onCreado={(resultado) => {
              setUsuarios((actual) => [...actual, resultado.usuario])
              setPasswordTemporal(resultado.passwordTemporal)
              setFormulario(null)
            }}
            onEditado={(usuario) => {
              actualizarUsuarioEnLista(usuario)
              setFormulario(null)
            }}
            onCancelar={() => setFormulario(null)}
          />
        )}
      </Modal>

      {passwordTemporal && (
        <ModalPasswordTemporal
          passwordTemporal={passwordTemporal}
          onCerrar={() => setPasswordTemporal(null)}
        />
      )}
    </div>
  )
}

function textoPuesto(usuario: UsuarioAdminDto) {
  return usuario.puesto ? (ETIQUETAS_PUESTO[usuario.puesto] ?? usuario.puesto) : '—'
}

const TONOS_RESUMEN = {
  brand: 'bg-brand-100 text-brand-700',
  green: 'bg-green-100 text-green-700',
  gray: 'bg-gray-100 text-gray-600',
  amber: 'bg-amber-100 text-amber-700',
} as const

function TarjetaResumen({
  Icono,
  etiqueta,
  valor,
  tono,
  cargando,
}: {
  Icono: LucideIcon
  etiqueta: string
  valor: number
  tono: keyof typeof TONOS_RESUMEN
  cargando: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONOS_RESUMEN[tono]}`}>
        <Icono className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <dt className="truncate text-xs font-medium text-gray-500">{etiqueta}</dt>
        <dd className="text-2xl font-semibold text-gray-900 tabular-nums">
          {cargando ? <span className="inline-block h-6 w-8 animate-pulse rounded bg-gray-200 align-middle" /> : valor}
        </dd>
      </div>
    </div>
  )
}

function Persona({ usuario }: { usuario: UsuarioAdminDto }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          usuario.isActive ? COLOR_ROL[usuario.rol].avatar : 'bg-gray-200 text-gray-500'
        }`}
      >
        {obtenerIniciales(usuario.nombreCompleto)}
      </span>
      <div className="min-w-0">
        <p className={`truncate font-medium ${usuario.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
          {usuario.nombreCompleto}
        </p>
        <p className="truncate text-xs text-gray-500">@{usuario.username}</p>
      </div>
    </div>
  )
}

function EtiquetaArea({ rol }: { rol: RolConLogin }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${COLOR_ROL[rol].etiqueta}`}
    >
      {rol === 'ADMINISTRACION' && <ShieldCheck className="h-3 w-3" />}
      {ETIQUETAS_ROL_CON_LOGIN[rol]}
    </span>
  )
}

const CLASE_ESTADO_ACTIVO = 'bg-green-50 text-green-700'
const CLASE_ESTADO_INACTIVO = 'bg-gray-100 text-gray-700'

function Estado({ usuario }: { usuario: UsuarioAdminDto }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          usuario.isActive ? CLASE_ESTADO_ACTIVO : CLASE_ESTADO_INACTIVO
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${usuario.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
        {usuario.isActive ? 'Activo' : 'Inactivo'}
      </span>
      {usuario.isActive && usuario.mustChangePassword && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
          <KeyRound className="h-3 w-3" />
          Contraseña temporal
        </span>
      )}
    </div>
  )
}

function FilasCargando() {
  return (
    <ul aria-busy="true" aria-label="Cargando usuarios" className="divide-y divide-gray-100">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
          <span className="h-9 w-9 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <span className="block h-3 w-40 rounded bg-gray-200" />
            <span className="block h-2.5 w-24 rounded bg-gray-100" />
          </div>
          <span className="hidden h-5 w-24 rounded-md bg-gray-100 md:block" />
          <span className="hidden h-5 w-16 rounded-full bg-gray-100 md:block" />
        </li>
      ))}
    </ul>
  )
}
