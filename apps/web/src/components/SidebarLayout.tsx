import { ChevronRight, Menu, X } from 'lucide-react'
import { type ComponentType, type ReactNode, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import LogoutButton from './LogoutButton'
import { TituloPaginaProvider, useTituloPaginaActual } from './TituloPagina'
import { useAuthStore } from '../store/auth.store'

export interface ItemNav {
  ruta: string
  etiqueta: string
  /** `true` = calce exacto. Necesario cuando la ruta es prefijo de las demás (el índice del área). */
  fin: boolean
  /**
   * Rutas que no cuelgan de `ruta` pero pertenecen a esta sección — p. ej. el formulario
   * `/psicologia/agenda/nueva-cita` frente al índice `/psicologia`. Sin esto, una sección con
   * `fin: true` deja el sidebar sin nada resaltado en sus propias pantallas hijas.
   */
  rutasRelacionadas?: string[]
  Icono: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}

interface SidebarLayoutProps {
  items: ItemNav[]
  subtitulo: string
  /** Contenido a la derecha del header — p. ej. el buscador global de Trabajo Social. */
  accionesHeader?: ReactNode
  /** Contador por `ruta` de `ItemNav` — p. ej. pendientes de Inicio. Solo se muestra si es mayor a 0. */
  contadores?: Partial<Record<string, number>>
  /** Se reenvía tal cual al `Outlet` — para que el layout cargue datos una sola vez y las páginas los lean con `useOutletContext`. */
  outletContext?: unknown
}

/** Una sola definición de "estoy en esta sección", usada por el resaltado y por el título. */
function estaActivo(item: ItemNav, pathname: string) {
  const calzaRutaPrincipal = item.fin ? pathname === item.ruta : pathname.startsWith(item.ruta)
  return calzaRutaPrincipal || (item.rutasRelacionadas?.some((ruta) => pathname.startsWith(ruta)) ?? false)
}

function obtenerIniciales(nombreCompleto: string) {
  const partes = nombreCompleto.trim().split(/\s+/)
  const primera = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primera + ultima).toUpperCase()
}

export default function SidebarLayout(props: SidebarLayoutProps) {
  return (
    <TituloPaginaProvider>
      <SidebarLayoutInterno {...props} />
    </TituloPaginaProvider>
  )
}

function SidebarLayoutInterno({ items, subtitulo, accionesHeader, contadores, outletContext }: SidebarLayoutProps) {
  const [sidebarAbierto, setSidebarAbierto] = useState(false)
  const usuario = useAuthStore((state) => state.usuario)
  const location = useLocation()
  const tituloPagina = useTituloPaginaActual()

  const paginaActual = items.find((item) => estaActivo(item, location.pathname))
  const titulo = tituloPagina?.titulo ?? paginaActual?.etiqueta ?? subtitulo
  const migas = tituloPagina?.migas

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
            <p className="text-xs font-medium tracking-wide text-brand-300">{subtitulo}</p>
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
          {items.map((item) => {
            const { ruta, etiqueta, Icono } = item
            const activo = item === paginaActual
            const contador = contadores?.[ruta]
            return (
              <NavLink
                key={ruta}
                to={ruta}
                onClick={() => setSidebarAbierto(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  activo ? 'bg-white/10 text-white' : 'text-brand-200 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icono size={18} strokeWidth={1.75} className={activo ? 'text-white' : 'text-brand-300'} />
                {etiqueta}
                {!!contador && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">
                    {contador}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
              {usuario ? obtenerIniciales(usuario.nombreCompleto) : ''}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{usuario?.nombreCompleto}</p>
              <p className="text-xs text-brand-300">{subtitulo}</p>
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
          <div className="min-w-0 flex-1">
            {migas && migas.length > 0 && (
              <nav aria-label="Ruta de navegación" className="mb-0.5 flex items-center gap-1 text-xs text-gray-500">
                {migas.map((miga, indice) => (
                  <span key={`${miga.etiqueta}-${indice}`} className="flex items-center gap-1">
                    {indice > 0 && <ChevronRight size={12} className="shrink-0" />}
                    {miga.ruta ? (
                      <Link to={miga.ruta} className="truncate hover:text-gray-700 hover:underline">
                        {miga.etiqueta}
                      </Link>
                    ) : (
                      <span className="truncate">{miga.etiqueta}</span>
                    )}
                  </span>
                ))}
              </nav>
            )}
            <h1 className="truncate text-xl font-semibold text-gray-900">{titulo}</h1>
          </div>

          {accionesHeader && <div className="flex shrink-0 items-center gap-2">{accionesHeader}</div>}
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-10">
          <Outlet context={outletContext} />
        </main>
      </div>
    </div>
  )
}
