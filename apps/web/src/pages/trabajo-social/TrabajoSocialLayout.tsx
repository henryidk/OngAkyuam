import { BarChart3, FolderOpen, LayoutDashboard, UserPlus } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import type { BandejaTs } from '@akyuam/shared'
import SidebarLayout, { type ItemNav } from '../../components/SidebarLayout'
import { useBandeja } from '../../features/trabajo-social/bandeja/useBandeja'

const ITEMS_NAV: ItemNav[] = [
  { ruta: '/trabajo-social', etiqueta: 'Inicio', fin: true, Icono: LayoutDashboard },
  { ruta: '/trabajo-social/registrar', etiqueta: 'Registrar usuaria', fin: false, Icono: UserPlus },
  { ruta: '/trabajo-social/usuarias', etiqueta: 'Usuarias', fin: false, Icono: FolderOpen },
  { ruta: '/trabajo-social/reportes', etiqueta: 'Reportes', fin: false, Icono: BarChart3 },
]

const RUTA_INICIO = '/trabajo-social'

export interface ContextoTrabajoSocial {
  bandeja: BandejaTs | null
  error: string | null
  recargar: () => Promise<void>
}

/** Para que las páginas del área lean la bandeja que ya cargó este layout, sin volver a pedirla. */
export function useContextoTrabajoSocial() {
  return useOutletContext<ContextoTrabajoSocial>()
}

export default function TrabajoSocialLayout() {
  const { bandeja, error, recargar } = useBandeja()
  const pendientes = (bandeja?.pendientesReferir.total ?? 0) + (bandeja?.documentosPendientes.total ?? 0)

  return (
    <SidebarLayout
      items={ITEMS_NAV}
      subtitulo="Trabajo social"
      contadores={{ [RUTA_INICIO]: pendientes }}
      outletContext={{ bandeja, error, recargar } satisfies ContextoTrabajoSocial}
    />
  )
}
