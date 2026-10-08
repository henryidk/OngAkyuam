import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import {
  BUSQUEDA_PSICOLOGIA_MAX,
  ETIQUETAS_FILTRO_PROCESOS_PSICOLOGIA,
  filtroProcesosPsicologiaSchema,
  type FiltroProcesosPsicologia,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Button from '../../../components/ui/Button'
import { ErrorVista } from '../../../components/ui/EstadosVista'
import { listarProcesos } from '../api/psicologia.api'
import { useContextoPsicologia } from '../compartido/contexto'
import { usePaginasCursor } from '../compartido/usePaginasCursor'
import FilaProceso from './FilaProceso'
import TarjetasFiltro from './TarjetasFiltro'

const ESPERA_BUSQUEDA_MS = 350
/** El servidor rechaza búsquedas más cortas. */
const LARGO_MINIMO_BUSQUEDA = 3
const COLUMNAS = ['Proceso', 'Usuaria', 'Etapa', 'Sesiones', 'Última sesión', 'Próxima cita']
const FILTRO_INICIAL: FiltroProcesosPsicologia = 'ACTIVOS'

function FilasEsqueleto() {
  return (
    <>
      {Array.from({ length: 5 }, (_, indice) => (
        <tr key={indice} className="border-t border-gray-100">
          {COLUMNAS.map((columna) => (
            <td key={columna} className="px-4 py-3">
              <div className="h-4 animate-pulse rounded bg-gray-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/**
 * Mis procesos psicológicos. El filtro vive en la URL; el término buscado no, para que el nombre
 * de una usuaria no quede en el historial del navegador.
 */
export default function ListaProcesos() {
  useTituloPagina({ titulo: 'Procesos' })
  const { resumen } = useContextoPsicologia()
  const [params, setParams] = useSearchParams()
  const filtroLeido = filtroProcesosPsicologiaSchema.safeParse(params.get('filtro'))
  const filtro = filtroLeido.success ? filtroLeido.data : FILTRO_INICIAL

  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const recortado = texto.trim()
  const siguienteBusqueda = recortado.length >= LARGO_MINIMO_BUSQUEDA ? recortado : ''
  useEffect(() => {
    if (siguienteBusqueda === busqueda) return
    const temporizador = setTimeout(() => setBusqueda(siguienteBusqueda), ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(temporizador)
  }, [siguienteBusqueda, busqueda])

  const cargar = useCallback(
    (cursor?: string) => listarProcesos({ filtro, q: busqueda || undefined, cursor }),
    [filtro, busqueda],
  )
  const { items, error, cargando, hayMas, cargarMas, cargandoMas, errorMas, recargar } = usePaginasCursor(
    `${filtro}|${busqueda}`,
    cargar,
  )

  function elegirFiltro(nuevo: FiltroProcesosPsicologia) {
    setParams(nuevo === FILTRO_INICIAL ? {} : { filtro: nuevo }, { replace: true })
  }

  const textoCorto = recortado.length > 0 && recortado.length < LARGO_MINIMO_BUSQUEDA

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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

      <TarjetasFiltro filtro={filtro} totales={resumen?.procesos ?? null} onElegir={elegirFiltro} />

      {error && !items ? (
        <ErrorVista
          mensaje={error.mensaje}
          sinPermiso={error.sinPermiso}
          recurso="los procesos"
          onReintentar={() => void recargar()}
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <caption className="sr-only">Procesos: {ETIQUETAS_FILTRO_PROCESOS_PSICOLOGIA[filtro]}</caption>
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  {COLUMNAS.map((columna) => (
                    <th key={columna} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium">
                      {columna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={cargando && items ? 'opacity-60' : undefined}>
                {!items && <FilasEsqueleto />}
                {items?.map((proceso) => (
                  <FilaProceso key={proceso.id} proceso={proceso} />
                ))}
              </tbody>
            </table>
          </div>
          {items?.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              {busqueda ? 'Ningún proceso coincide con la búsqueda.' : 'No hay procesos en esta lista.'}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-[#fcfcfd] px-4 py-3.5 text-[13px] text-gray-500">
            <span>
              Un proceso se abre al agendar la primera cita de un caso tomado, desde la{' '}
              <Link to="/psicologia/agenda" className="font-medium text-brand-700 hover:underline">
                Agenda
              </Link>
              .
            </span>
            {hayMas && (
              <Button variante="secondary" cargando={cargandoMas} onClick={() => void cargarMas()}>
                Cargar más
              </Button>
            )}
          </div>
          {errorMas && (
            <p role="alert" className="px-4 pb-3 text-sm text-red-600">
              {errorMas}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
