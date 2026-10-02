import { NavLink } from 'react-router-dom'
import { useEnlaceProtegido } from '../../lib/guardiaSalida'

export interface TabItem {
  to: string
  etiqueta: string
  /** Coincidencia exacta de ruta (para la pestaña índice) — mismo significado que `end` de `NavLink`. */
  fin?: boolean
}

interface TabsProps {
  items: TabItem[]
  className?: string
}

/** Pestañas de navegación por rutas anidadas (ej. la ficha de la usuaria) — el estado activo sale de la URL, nunca de `useState`. */
export default function Tabs({ items, className }: TabsProps) {
  const protegerEnlace = useEnlaceProtegido()
  return (
    <nav className={`flex gap-1 overflow-x-auto ${className ?? ''}`}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.fin}
          onClick={(evento) => protegerEnlace(evento, item.to)}
          className={({ isActive }) =>
            `whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${
              isActive
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`
          }
        >
          {item.etiqueta}
        </NavLink>
      ))}
    </nav>
  )
}
