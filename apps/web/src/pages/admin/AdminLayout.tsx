import { Users } from 'lucide-react'
import SidebarLayout, { type ItemNav } from '../../components/SidebarLayout'

const ITEMS_NAV: ItemNav[] = [
  { ruta: '/admin/usuarios', etiqueta: 'Usuarios', fin: false, Icono: Users },
]

export default function AdminLayout() {
  return <SidebarLayout items={ITEMS_NAV} subtitulo="Administración" />
}
