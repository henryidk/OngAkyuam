import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import {
  BUSQUEDA_PSICOLOGIA_MAX,
  ETIQUETAS_FILTRO_PROCESOS_PSICOLOGIA,
  PAGINA_MAX_PROCESOS_PSICOLOGIA,
  PROCESOS_PSICOLOGIA_POR_PAGINA,
  filtroProcesosPsicologiaSchema,
  type FiltroProcesosPsicologia,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import { ErrorVista } from '../../../components/ui/EstadosVista'
import TablaDatos from '../../../components/ui/TablaDatos'
import { usePaginaConFilas, usePaginaUrl } from '../../../lib/usePaginaUrl'
import { useRecurso } from '../../../lib/useRecurso'
import { listarProcesos } from '../api/psicologia.api'
import { useContextoPsicologia } from '../compartido/contexto'
import SelectorAlcance from '../compartido/SelectorAlcance'
import { columnasProcesos } from './columnasProcesos'
import TarjetasFiltro from './TarjetasFiltro'

const ESPERA_BUSQUEDA_MS = 350
/** El servidor rechaza búsquedas más cortas. */
const LARGO_MINIMO_BUSQUEDA = 3
const FILTRO_INICIAL: FiltroProcesosPsicologia = 'ACTIVOS'

/**
 * Procesos psicológicos: los míos o los de toda el área (`?de=equipo`), por páginas numeradas. El
 * filtro, el alcance y la página viven en la URL; el término buscado no, para que el nombre de una
 * usuaria no quede en el historial del navegador.
 */
export default function ListaProcesos() {
  useTituloPagina({ titulo: 'Procesos' })
  const { resumen } = useContextoPsicologia()

  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const recortado = texto.trim()
  const siguienteBusqueda = recortado.length >= LARGO_MINIMO_BUSQUEDA ? recortado : ''
  useEffect(() => {
    if (siguienteBusqueda === busqueda) return
    const temporizador = setTimeout(() => setBusqueda(siguienteBusqueda), ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(temporizador)
  }, [siguienteBusqueda, busqueda])

  const { pagina, params, cambiarParams, irAPagina } = usePaginaUrl(PAGINA_MAX_PROCESOS_PSICOLOGIA, busqueda)
  const filtroLeido = filtroProcesosPsicologiaSchema.safeParse(params.get('filtro'))
  const filtro = filtroLeido.success ? filtroLeido.data : FILTRO_INICIAL
  const equipo = params.get('de') === 'equipo'
  const de = equipo ? 'EQUIPO' : 'MIOS'

  const lista = useRecurso(
    useCallback(
      () => listarProcesos({ filtro, de, q: busqueda || undefined, pagina }),
      [filtro, de, busqueda, pagina],
    ),
  )
  const datos = lista.datos
  usePaginaConFilas(datos, irAPagina)

  /** Otro filtro u otro alcance es otra lista: vuelve a la primera página. */
  function irA(nuevoFiltro: FiltroProcesosPsicologia, nuevoEquipo: boolean) {
    cambiarParams({
      filtro: nuevoFiltro !== FILTRO_INICIAL ? nuevoFiltro : undefined,
      de: nuevoEquipo ? 'equipo' : undefined,
      pagina: undefined,
    })
  }

  const textoCorto = recortado.length > 0 && recortado.length < LARGO_MINIMO_BUSQUEDA

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <SelectorAlcance etiqueta="Procesos" valor={de} onCambio={(alcance) => irA(filtro, alcance === 'EQUIPO')} />
        <p className="min-w-[240px] flex-1 text-[13px] text-gray-500">
          Cada proceso va de Inicio a Seguimiento y Cierre. El historial completo de cada usuaria está en su
          expediente.
        </p>
        <label className="relative block w-full sm:w-[340px]">
          <span className="sr-only">Buscar por usuaria o número de expediente</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={texto}
            maxLength={BUSQUEDA_PSICOLOGIA_MAX}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder="Buscar por usuaria o expediente"
            autoComplete="off"
            className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>
      {textoCorto && <p className="text-xs text-gray-500">Escribe al menos {LARGO_MINIMO_BUSQUEDA} caracteres.</p>}

      <TarjetasFiltro
        filtro={filtro}
        totales={(equipo ? resumen?.procesosEquipo : resumen?.procesos) ?? null}
        onElegir={(nuevo) => irA(nuevo, equipo)}
      />

      {lista.error ? (
        <ErrorVista
          mensaje={lista.error.mensaje}
          sinPermiso={lista.error.sinPermiso}
          recurso="los procesos"
          onReintentar={() => void lista.recargar()}
        />
      ) : (
        <TablaDatos
          titulo={`Procesos ${equipo ? 'del equipo' : 'míos'}: ${ETIQUETAS_FILTRO_PROCESOS_PSICOLOGIA[filtro]}`}
          columnas={columnasProcesos(equipo)}
          filas={datos?.items ?? null}
          claveFila={(proceso) => proceso.id}
          vacio={busqueda ? 'Ningún proceso coincide con la búsqueda.' : 'No hay procesos en esta lista.'}
          paginacion={
            datos
              ? {
                  pagina: datos.pagina,
                  porPagina: datos.porPagina,
                  total: datos.total,
                  totalNavegable: Math.min(datos.total, PAGINA_MAX_PROCESOS_PSICOLOGIA * PROCESOS_PSICOLOGIA_POR_PAGINA),
                  onCambiar: irAPagina,
                }
              : undefined
          }
        />
      )}

      <p className="text-[12.5px] text-texto-suave">
        Un proceso se abre al agendar la primera cita de un caso tomado, desde la{' '}
        <Link to="/psicologia/agenda" className="font-medium text-brand-700 hover:underline">
          Agenda
        </Link>
        .
      </p>
    </div>
  )
}
