import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { BUSQUEDA_MAX, LARGO_MINIMO_BUSQUEDA_PROCESOS } from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Button from '../../../components/ui/Button'
import Switch from '../../../components/ui/Switch'
import { listarProcesos } from '../api/juridico.api'
import { ErrorVista } from '../compartido/EstadosVista'
import { useRecurso } from '../compartido/useRecurso'
import FilaProceso from './FilaProceso'

const ESPERA_BUSQUEDA_MS = 350
const COLUMNAS = ['No. interno', 'Usuaria', 'Tipo de proceso', 'Avance', 'Seguimiento']

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
 * Lista de trabajo: solo procesos en trámite. "Solo asignados a mí" y la página viven en la URL;
 * el término buscado no, para que el nombre de una usuaria no quede en el historial del navegador.
 */
export default function ListaProcesos() {
  useTituloPagina({ titulo: 'Procesos' })
  const [params, setParams] = useSearchParams()
  const mios = params.get('mios') === 'true'
  const pagina = Math.max(1, Number(params.get('page')) || 1)

  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const siguienteBusqueda = texto.trim().length >= LARGO_MINIMO_BUSQUEDA_PROCESOS ? texto.trim() : ''
  useEffect(() => {
    if (siguienteBusqueda === busqueda) return
    const temporizador = setTimeout(() => {
      setBusqueda(siguienteBusqueda)
      // Una búsqueda nueva siempre empieza en la primera página.
      setParams(
        (actual) => {
          const siguiente = new URLSearchParams(actual)
          siguiente.delete('page')
          return siguiente
        },
        { replace: true },
      )
    }, ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(temporizador)
  }, [siguienteBusqueda, busqueda, setParams])

  const cargar = useCallback(
    () => listarProcesos({ q: busqueda || undefined, mios: mios || undefined, page: pagina }),
    [busqueda, mios, pagina],
  )
  const { datos, error, cargando, recargar } = useRecurso(cargar)

  function actualizarParams(cambios: { mios?: boolean; page?: number }) {
    setParams(
      (actual) => {
        const siguiente = new URLSearchParams(actual)
        if (cambios.mios !== undefined) {
          if (cambios.mios) siguiente.set('mios', 'true')
          else siguiente.delete('mios')
          siguiente.delete('page')
        }
        if (cambios.page !== undefined) {
          if (cambios.page > 1) siguiente.set('page', String(cambios.page))
          else siguiente.delete('page')
        }
        return siguiente
      },
      { replace: true },
    )
  }

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.pageSize)) : 1
  const textoCorto = texto.trim().length > 0 && texto.trim().length < LARGO_MINIMO_BUSQUEDA_PROCESOS

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="relative block w-full sm:w-[360px]">
          <span className="sr-only">Buscar por usuaria, No. interno o No. judicial</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={texto}
            maxLength={BUSQUEDA_MAX}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder="Buscar por usuaria, No. interno o No. judicial"
            autoComplete="off"
            className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <p className="min-w-[240px] flex-1 text-[13px] text-gray-500">
          Procesos en curso. Los finalizados, suspendidos y abandonados se consultan en el expediente de cada usuaria.
        </p>
        <div className="flex items-center gap-2 text-[13px] text-gray-700">
          <Switch encendido={mios} onChange={(valor) => actualizarParams({ mios: valor })} ariaLabel="Solo asignados a mí" />
          <span aria-hidden="true">Solo asignados a mí</span>
        </div>
      </div>
      {textoCorto && (
        <p className="text-xs text-gray-500">Escribe al menos {LARGO_MINIMO_BUSQUEDA_PROCESOS} caracteres.</p>
      )}

      {error && !datos ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="los procesos" onReintentar={() => void recargar()} />
      ) : (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  {COLUMNAS.map((columna) => (
                    <th key={columna} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium">
                      {columna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={cargando && datos ? 'opacity-60' : undefined}>
                {!datos && <FilasEsqueleto />}
                {datos?.items.map((proceso) => (
                  <FilaProceso key={proceso.id} proceso={proceso} />
                ))}
              </tbody>
            </table>
          </div>
          {datos && datos.items.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              {busqueda ? 'Ningún proceso en curso coincide con la búsqueda.' : 'No hay procesos en curso.'}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-[#fcfcfd] px-4 py-3.5 text-[13px] text-gray-500">
            <span className="tabular-nums">
              {datos ? `${datos.total} ${datos.total === 1 ? 'proceso' : 'procesos'} en curso` : ' '}
              {datos && totalPaginas > 1 && ` · página ${datos.page} de ${totalPaginas}`}
            </span>
            {datos && totalPaginas > 1 ? (
              <div className="flex gap-2">
                <Button variante="secondary" disabled={datos.page <= 1} onClick={() => actualizarParams({ page: datos.page - 1 })}>
                  Anterior
                </Button>
                <Button
                  variante="secondary"
                  disabled={datos.page >= totalPaginas}
                  onClick={() => actualizarParams({ page: datos.page + 1 })}
                >
                  Siguiente
                </Button>
              </div>
            ) : (
              <span>Los procesos nuevos se registran desde la ficha de la usuaria.</span>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
