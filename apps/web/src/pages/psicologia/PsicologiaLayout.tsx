import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarDays, HeartHandshake, Inbox, Users } from 'lucide-react'
import type { ResumenProcesosPsicologia } from '@akyuam/shared'
import SidebarLayout, { type ItemNav } from '../../components/SidebarLayout'
import { obtenerResumenProcesos } from '../../features/psicologia/api/psicologia.api'
import type { ContextoPsicologia } from '../../features/psicologia/compartido/contexto'
import { RUTAS_PSICOLOGIA } from '../../features/psicologia/rutas'
import { crearSocketArea } from '../../lib/socket'

// El detalle y el registro de una cita cuelgan de "/psicologia/citas", pero son parte de la
// agenda: `rutasRelacionadas` mantiene resaltado su ítem ahí.
const ITEMS_NAV: ItemNav[] = [
  { ruta: RUTAS_PSICOLOGIA.atencion(), etiqueta: 'Área de atención', fin: false, Icono: Inbox },
  {
    ruta: RUTAS_PSICOLOGIA.agenda(),
    etiqueta: 'Agenda',
    fin: false,
    rutasRelacionadas: ['/psicologia/citas'],
    Icono: CalendarDays,
  },
  { ruta: RUTAS_PSICOLOGIA.procesos(), etiqueta: 'Procesos', fin: false, Icono: HeartHandshake },
  {
    ruta: RUTAS_PSICOLOGIA.usuarias(),
    etiqueta: 'Usuarias',
    fin: false,
    // La pantalla anterior del expediente sigue viva hasta que se retire: pertenece a este ítem.
    rutasRelacionadas: ['/psicologia/expedientes'],
    Icono: Users,
  },
  { ruta: '/psicologia/indicadores', etiqueta: 'Reportes', fin: false, Icono: BarChart3 },
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
  // La insignia de la agenda suma lo que pide acción ahí: casos tomados sin primera cita y citas
  // ya pasadas sin registrar.
  const contadores = resumen && {
    [RUTAS_PSICOLOGIA.atencion()]: resumen.referenciasSinTomar,
    [RUTAS_PSICOLOGIA.agenda()]: resumen.casosPorAgendar + resumen.citasSinRegistrar,
    [RUTAS_PSICOLOGIA.procesos()]: resumen.procesos.ACTIVOS,
  }

  return (
    <SidebarLayout
      items={ITEMS_NAV}
      subtitulo="Psicológica"
      contadores={contadores ?? undefined}
      outletContext={contexto}
    />
  )
}
