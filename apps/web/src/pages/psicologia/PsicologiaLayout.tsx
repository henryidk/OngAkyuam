import { BarChart3, CalendarDays, FolderSearch } from 'lucide-react'
import SidebarLayout, { type ItemNav } from '../../components/SidebarLayout'

// Tres secciones (§5 del plan): la agenda es la pantalla de entrada del área, por eso vive en
// "/psicologia" con fin: true — al ser prefijo de las demás, con fin: false se resaltaría junto
// con ellas. `rutasRelacionadas` devuelve el resaltado en el formulario de agendar, que es suyo.
const ITEMS_NAV: ItemNav[] = [
  {
    ruta: '/psicologia',
    etiqueta: 'Agenda',
    fin: true,
    rutasRelacionadas: ['/psicologia/agenda', '/psicologia/citas'],
    Icono: CalendarDays,
  },
  { ruta: '/psicologia/expedientes', etiqueta: 'Expedientes', fin: false, Icono: FolderSearch },
  { ruta: '/psicologia/indicadores', etiqueta: 'Indicadores', fin: false, Icono: BarChart3 },
]

export default function PsicologiaLayout() {
  return <SidebarLayout items={ITEMS_NAV} subtitulo="Psicológica" />
}
