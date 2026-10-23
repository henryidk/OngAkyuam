import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarDays, Inbox, Stethoscope, Users } from 'lucide-react'
import type { ContadoresMedicaDto } from '@akyuam/shared'
import SidebarLayout, { type ItemNav } from '../../components/SidebarLayout'
import { obtenerContadores } from '../../features/medica/api/medica.api'
import type { ContextoMedica } from '../../features/medica/compartido/contexto'
import { RUTAS_MEDICA } from '../../features/medica/rutas'
import { crearSocketArea } from '../../lib/socket'

const ITEMS_NAV: ItemNav[] = [
  { ruta: RUTAS_MEDICA.atencion(), etiqueta: 'Área de atención', fin: false, Icono: Inbox },
  { ruta: '/medica/agenda', etiqueta: 'Agenda', fin: false, Icono: CalendarDays },
  { ruta: '/medica/consultas', etiqueta: 'Consultas', fin: false, Icono: Stethoscope },
  { ruta: '/medica/pacientes', etiqueta: 'Pacientes', fin: false, Icono: Users },
  { ruta: '/medica/reportes', etiqueta: 'Reportes', fin: false, Icono: BarChart3 },
]

export default function MedicaLayout() {
  const [contadores, setContadores] = useState<ContadoresMedicaDto | null>(null)
  const [versionNovedades, setVersionNovedades] = useState(0)

  // Las insignias son un apoyo: si los contadores fallan, el menú sigue funcionando sin ellas.
  const recargarContadores = useCallback(() => {
    obtenerContadores()
      .then(setContadores)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    recargarContadores()
  }, [recargarContadores])

  // El aviso no trae datos: solo dice "vuelve a pedir". Qué puede ver Medicina se decide en el
  // backend, en cada petición HTTP.
  useEffect(() => {
    const socket = crearSocketArea()
    const alCambiar = () => {
      recargarContadores()
      setVersionNovedades((version) => version + 1)
    }
    socket.on('novedades:cambio', alCambiar)
    socket.on('referido:nuevo', alCambiar)
    return () => {
      socket.disconnect()
    }
  }, [recargarContadores])

  const contexto = useMemo<ContextoMedica>(
    () => ({ contadores, recargarContadores, versionNovedades }),
    [contadores, recargarContadores, versionNovedades],
  )

  return (
    <SidebarLayout
      items={ITEMS_NAV}
      subtitulo="Medicina"
      contadores={
        contadores
          ? { [RUTAS_MEDICA.atencion()]: contadores.areaAtencion, '/medica/consultas': contadores.consultasPorAtender }
          : undefined
      }
      outletContext={contexto}
    />
  )
}
