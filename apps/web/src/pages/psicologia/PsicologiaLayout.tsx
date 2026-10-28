import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarDays, ClipboardCheck, HeartHandshake, Inbox, Users } from 'lucide-react'
import type { ResumenProcesosPsicologia } from '@akyuam/shared'
import SidebarLayout, { type ItemNav } from '../../components/SidebarLayout'
import { obtenerResumenProcesos } from '../../features/psicologia/api/psicologia.api'
import type { ContextoPsicologia } from '../../features/psicologia/compartido/contexto'
import { RUTAS_PSICOLOGIA } from '../../features/psicologia/rutas'
import { crearSocketArea } from '../../lib/socket'

// El detalle y el registro de una cita cuelgan de "/psicologia/citas", pero son parte de la
// agenda: `rutasRelacionadas` mantiene resaltado su ítem ahí. Consultas no la lleva: si las dos
// la tuvieran, se resaltarían ambas.
const ITEMS_NAV: ItemNav[] = [
  { ruta: RUTAS_PSICOLOGIA.atencion(), etiqueta: 'Área de atención', fin: false, Icono: Inbox },
  {
    ruta: RUTAS_PSICOLOGIA.agenda(),
    etiqueta: 'Agenda',
    fin: false,
    rutasRelacionadas: ['/psicologia/citas'],
    Icono: CalendarDays,
  },
  { ruta: RUTAS_PSICOLOGIA.consultas(), etiqueta: 'Consultas', fin: false, Icono: ClipboardCheck },
  { ruta: RUTAS_PSICOLOGIA.procesos(), etiqueta: 'Procesos', fin: false, Icono: HeartHandshake },
  { ruta: RUTAS_PSICOLOGIA.usuarias(), etiqueta: 'Usuarias', fin: false, Icono: Users },
  { ruta: RUTAS_PSICOLOGIA.reportes(), etiqueta: 'Reportes', fin: false, Icono: BarChart3 },
]

export default function PsicologiaLayout() {
  const [resumen, setResumen] = useState<ResumenProcesosPsicologia | null>(null)
  const [versionNovedades, setVersionNovedades] = useState(0)

  // Las insignias son un apoyo: si el resumen falla, el menú sigue funcionando sin ellas.
  const recargarResumen = useCallback(() => {
    obtenerResumenProcesos()
      .then(setResumen)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    recargarResumen()
  }, [recargarResumen])

  // El aviso no trae datos: solo dice "vuelve a pedir". Lo que cada psicóloga puede ver se
  // decide en el backend, en cada petición HTTP.
  useEffect(() => {
    const socket = crearSocketArea()
    socket.on('novedades:cambio', () => {
      recargarResumen()
      setVersionNovedades((version) => version + 1)
    })
    return () => {
      socket.disconnect()
    }
  }, [recargarResumen])

  const contexto = useMemo<ContextoPsicologia>(
    () => ({ resumen, recargarResumen, versionNovedades }),
    [resumen, recargarResumen, versionNovedades],
  )
  // Una sola insignia, la de lo que solo yo puedo resolver: mis sesiones por registrar. Varias
  // a la vez compiten por la atención y ninguna se lee.
  const contadores = resumen && { [RUTAS_PSICOLOGIA.consultas()]: resumen.sesionesPorRegistrar }

  return (
    <SidebarLayout
      items={ITEMS_NAV}
      subtitulo="Psicológica"
      contadores={contadores ?? undefined}
      outletContext={contexto}
    />
  )
}
