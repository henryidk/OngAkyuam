import { FolderOpen, LayoutDashboard, Menu, UserPlus, X } from 'lucide-react'
import { type ComponentType, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import LogoutButton from '../../components/LogoutButton'
import { useAuthStore } from '../../store/auth.store'

interface ItemNav {
  ruta: string
  etiqueta: string
  fin: boolean
  Icono: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}

const ITEMS_NAV: ItemNav[] = [
  { ruta: '/trabajo-social', etiqueta: 'Inicio', fin: true, Icono: LayoutDashboard },
  { ruta: '/trabajo-social/registrar', etiqueta: 'Registrar usuaria', fin: false, Icono: UserPlus },
  { ruta: '/trabajo-social/expediente', etiqueta: 'Expediente', fin: false, Icono: FolderOpen },
]

function obtenerIniciales(nombreCompleto: string) {
  const partes = nombreCompleto.trim().split(/\s+/)
  const primera = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primera + ultima).toUpperCase()
}

export default function TrabajoSocialLayout() {
  const [sidebarAbierto, setSidebarAbierto] = useState(false)
  const usuario = useAuthStore((state) => state.usuario)
  const location = useLocation()

  const paginaActual = ITEMS_NAV.find((item) =>
    item.fin ? location.pathname === item.ruta : location.pathname.startsWith(item.ruta),
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      {sidebarAbierto && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setSidebarAbierto(false)}
          className="fixed inset-0 z-30 bg-gray-900/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col overflow-y-auto bg-brand-950 transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          sidebarAbierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 pt-6 pb-5">
          <div>
            <p className="text-lg font-semibold tracking-tight text-white">AKyuam</p>
            <p className="text-xs font-medium tracking-wide text-brand-300">Trabajo social</p>
          </div>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setSidebarAbierto(false)}
            className="rounded p-1 text-brand-300 hover:text-white lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {ITEMS_NAV.map(({ ruta, etiqueta, fin, Icono }) => (
            <NavLink
              key={ruta}
              to={ruta}
              end={fin}
              onClick={() => setSidebarAbierto(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/10 text-white' : 'text-brand-200 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icono size={18} strokeWidth={1.75} className={isActive ? 'text-white' : 'text-brand-300'} />
                  {etiqueta}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
              {usuario ? obtenerIniciales(usuario.nombreCompleto) : ''}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{usuario?.nombreCompleto}</p>
              <p className="text-xs text-brand-300">Trabajo social</p>
            </div>
          </div>
          <div className="mt-3">
            <LogoutButton variante="oscuro" />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-4 lg:px-8">
          <button
            type="button"
            aria-label="Abrir menú"
            onClick={() => setSidebarAbierto(true)}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-xl font-semibold text-gray-900">{paginaActual?.etiqueta ?? 'Trabajo social'}</h1>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
