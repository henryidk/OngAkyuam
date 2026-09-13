import { FolderOpen, LayoutDashboard, UserPlus } from 'lucide-react'
import SidebarLayout, { type ItemNav } from '../../components/SidebarLayout'

const ITEMS_NAV: ItemNav[] = [
  { ruta: '/trabajo-social', etiqueta: 'Inicio', fin: true, Icono: LayoutDashboard },
  { ruta: '/trabajo-social/registrar', etiqueta: 'Registrar usuaria', fin: false, Icono: UserPlus },
  { ruta: '/trabajo-social/expediente', etiqueta: 'Expediente', fin: false, Icono: FolderOpen },
]

export default function TrabajoSocialLayout() {
  return <SidebarLayout items={ITEMS_NAV} subtitulo="Trabajo social" />
}
