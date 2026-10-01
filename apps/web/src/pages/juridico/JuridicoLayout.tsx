import { useCallback, useEffect, useMemo, useState } from 'react'
import { FolderSearch, Inbox, Scale } from 'lucide-react'
import type { ResumenProcesos } from '@akyuam/shared'
import SidebarLayout, { type ItemNav } from '../../components/SidebarLayout'
import { obtenerResumen } from '../../features/juridico/api/juridico.api'
import type { ContextoJuridico } from '../../features/juridico/compartido/contexto'
import { RUTAS_JURIDICO } from '../../features/juridico/rutas'

// El Área de atención vive en "/juridico" con fin: true: al ser prefijo de las demás, con
// fin: false se resaltaría junto con ellas. La ficha de una usuaria pertenece a Expedientes.
const ITEMS_NAV: ItemNav[] = [
  { ruta: RUTAS_JURIDICO.bandeja(), etiqueta: 'Área de atención', fin: true, Icono: Inbox },
  { ruta: RUTAS_JURIDICO.procesos(), etiqueta: 'Procesos', fin: false, Icono: Scale },
  {
    ruta: RUTAS_JURIDICO.expedientes(),
    etiqueta: 'Expedientes',
    fin: false,
    rutasRelacionadas: ['/juridico/usuarias'],
    Icono: FolderSearch,
  },
]

export default function JuridicoLayout() {
  const [resumen, setResumen] = useState<ResumenProcesos | null>(null)

  // Las insignias son un apoyo: si el resumen falla, el menú sigue funcionando sin ellas.
  const recargarResumen = useCallback(() => {
    obtenerResumen()
      .then(setResumen)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    recargarResumen()
  }, [recargarResumen])

  const contexto = useMemo<ContextoJuridico>(() => ({ resumen, recargarResumen }), [resumen, recargarResumen])
  const contadores = resumen && {
    [RUTAS_JURIDICO.bandeja()]: resumen.referenciasPendientes,
    [RUTAS_JURIDICO.procesos()]: resumen.enTramite + resumen.suspendidos,
  }

  return <SidebarLayout items={ITEMS_NAV} subtitulo="Jurídica" contadores={contadores ?? undefined} outletContext={contexto} />
}
