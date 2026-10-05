import { useCallback, useEffect, useMemo, useState } from 'react'
import { Home, Inbox, Scale, Users } from 'lucide-react'
import type { ResumenProcesos } from '@akyuam/shared'
import SidebarLayout, { type ItemNav } from '../../components/SidebarLayout'
import { obtenerResumen } from '../../features/juridico/api/juridico.api'
import type { ContextoJuridico } from '../../features/juridico/compartido/contexto'
import { RUTAS_JURIDICO } from '../../features/juridico/rutas'
import { crearSocketArea } from '../../lib/socket'

// Inicio vive en "/juridico" con fin: true: al ser prefijo de las demás, con fin: false se
// resaltaría junto con ellas. La ficha de una usuaria cuelga de Usuarias.
const ITEMS_NAV: ItemNav[] = [
  { ruta: RUTAS_JURIDICO.inicio(), etiqueta: 'Inicio', fin: true, Icono: Home },
  { ruta: RUTAS_JURIDICO.bandeja(), etiqueta: 'Área de atención', fin: false, Icono: Inbox },
  { ruta: RUTAS_JURIDICO.procesos(), etiqueta: 'Procesos', fin: false, Icono: Scale },
  { ruta: RUTAS_JURIDICO.usuarias(), etiqueta: 'Usuarias', fin: false, Icono: Users },
]

export default function JuridicoLayout() {
  const [resumen, setResumen] = useState<ResumenProcesos | null>(null)
  const [versionNovedades, setVersionNovedades] = useState(0)

  // Las insignias son un apoyo: si el resumen falla, el menú sigue funcionando sin ellas.
  const recargarResumen = useCallback(() => {
    obtenerResumen()
      .then(setResumen)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    recargarResumen()
  }, [recargarResumen])

  // El aviso no trae datos: solo dice "vuelve a pedir". Lo que Jurídico puede ver se decide en
  // el backend, en cada petición HTTP.
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

  const contexto = useMemo<ContextoJuridico>(
    () => ({ resumen, recargarResumen, versionNovedades }),
    [resumen, recargarResumen, versionNovedades],
  )
  const contadores = resumen && {
    [RUTAS_JURIDICO.bandeja()]: resumen.referenciasPendientes,
    [RUTAS_JURIDICO.procesos()]: resumen.enTramite,
  }

  return <SidebarLayout items={ITEMS_NAV} subtitulo="Jurídica" contadores={contadores ?? undefined} outletContext={contexto} />
}
