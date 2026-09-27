import { BarChart3, CalendarDays, FolderSearch, Inbox } from 'lucide-react'
import SidebarLayout, { type ItemNav } from '../../components/SidebarLayout'

// "Atención" usa fin: true (calce exacto con "/psicologia"): al ser prefijo de las otras
// rutas, con fin: false quedaría resaltado junto con ellas.
const ITEMS_NAV: ItemNav[] = [
  { ruta: '/psicologia', etiqueta: 'Atención', fin: true, Icono: Inbox },
  { ruta: '/psicologia/agenda', etiqueta: 'Agenda', fin: false, Icono: CalendarDays },
  { ruta: '/psicologia/expedientes', etiqueta: 'Expedientes', fin: false, Icono: FolderSearch },
  { ruta: '/psicologia/indicadores', etiqueta: 'Indicadores', fin: false, Icono: BarChart3 },
]

export default function PsicologiaLayout() {
  return <SidebarLayout items={ITEMS_NAV} subtitulo="Psicológica" />
}
