import { BarChart3, CalendarDays, Users } from 'lucide-react'
import SidebarLayout, { type ItemNav } from '../../components/SidebarLayout'

// "Pacientes" usa fin: true (calce exacto con "/psicologia"): al ser prefijo de las otras
// dos rutas, con fin: false quedaría resaltado en Agenda y Reporte al mismo tiempo que ellas.
const ITEMS_NAV: ItemNav[] = [
  { ruta: '/psicologia', etiqueta: 'Pacientes', fin: true, Icono: Users },
  { ruta: '/psicologia/agenda', etiqueta: 'Agenda', fin: false, Icono: CalendarDays },
  { ruta: '/psicologia/reporte', etiqueta: 'Reporte', fin: false, Icono: BarChart3 },
]

export default function PsicologiaLayout() {
  return <SidebarLayout items={ITEMS_NAV} subtitulo="Psicológica" />
}
