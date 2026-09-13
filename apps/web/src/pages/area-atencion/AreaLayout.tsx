import { Inbox } from 'lucide-react'
import SidebarLayout, { type ItemNav } from '../../components/SidebarLayout'

interface AreaLayoutProps {
  subtitulo: string
  basePath: string
}

export default function AreaLayout({ subtitulo, basePath }: AreaLayoutProps) {
  const items: ItemNav[] = [
    { ruta: basePath, etiqueta: 'Área de atención', fin: false, Icono: Inbox },
  ]

  return <SidebarLayout items={items} subtitulo={subtitulo} />
}
