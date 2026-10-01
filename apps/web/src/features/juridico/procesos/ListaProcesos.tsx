import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Scale, Search } from 'lucide-react'
import {
  BUSQUEDA_MAX,
  ETIQUETAS_FORMA_FINALIZACION,
  listarProcesosQuerySchema,
  type ListarProcesosQuery,
  type ResumenProcesos,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Button from '../../../components/ui/Button'
import EmptyState from '../../../components/ui/EmptyState'
import { listarProcesos } from '../api/juridico.api'
import { CLASE_CAMPO } from '../compartido/campos'
import { useContextoJuridico } from '../compartido/contexto'
import { ErrorVista, Esqueleto } from '../compartido/EstadosVista'
import { useRecurso } from '../compartido/useRecurso'
import FilaProceso from './FilaProceso'
import TarjetasResumen from './TarjetasResumen'

const ESPERA_BUSQUEDA_MS = 350

type FiltrosUrl = Pick<ListarProcesosQuery, 'estado' | 'forma' | 'requiereAtencion'>

interface Filtro {
  etiqueta: string
  filtros: FiltrosUrl
  contar: (resumen: ResumenProcesos) => number
}

const FILTROS: Filtro[] = [
  { etiqueta: 'Todos', filtros: {}, contar: (resumen) => resumen.total },
  { etiqueta: 'En trámite', filtros: { estado: 'EN_TRAMITE' }, contar: (resumen) => resumen.enTramite },
  { etiqueta: 'Suspendidos', filtros: { estado: 'SUSPENDIDO' }, contar: (resumen) => resumen.suspendidos },
  { etiqueta: 'Finalizados', filtros: { estado: 'FINALIZADO' }, contar: (resumen) => resumen.finalizados },
  { etiqueta: 'Abandonados', filtros: { estado: 'ABANDONADO' }, contar: (resumen) => resumen.abandonados },
  {
    etiqueta: 'Requieren atención',
    filtros: { requiereAtencion: true },
    contar: (resumen) => resumen.requierenAtencion,
  },
]

function mismoFiltro(query: ListarProcesosQuery, filtros: FiltrosUrl) {
  return query.estado === filtros.estado && !!query.requiereAtencion === !!filtros.requiereAtencion
}

/** Lee los filtros de la URL; un valor inválido (enlace viejo o editado a mano) se ignora. */
function leerQuery(searchParams: URLSearchParams): ListarProcesosQuery {
  const crudo = Object.fromEntries(searchParams)
  const validado = listarProcesosQuerySchema.safeParse(crudo)
  return validado.success ? validado.data : listarProcesosQuerySchema.parse({})
}

export default function ListaProcesos() {
  useTituloPagina({ titulo: 'Procesos' })
  const { resumen } = useContextoJuridico()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = leerQuery(searchParams)
  const { estado, forma, requiereAtencion, q, page, pageSize } = query

  const cargar = useCallback(
    () => listarProcesos({ estado, forma, requiereAtencion, q: q || undefined, page, pageSize }),
    [estado, forma, requiereAtencion, q, page, pageSize],
  )
  const { datos, error, recargar } = useRecurso(cargar)

  /** Cambiar un filtro siempre vuelve a la primera página. */
  const actualizarUrl = useCallback(
    (cambios: Record<string, string | undefined>) => {
      setSearchParams((actuales) => {
        const siguiente = new URLSearchParams(actuales)
        siguiente.delete('page')
        for (const [clave, valor] of Object.entries(cambios)) {
          if (valor) siguiente.set(clave, valor)
          else siguiente.delete(clave)
        }
        return siguiente
      })
    },
    [setSearchParams],
  )

  // El texto se escribe en local y pasa a la URL tras una pausa: no se pide en cada tecla.
  const [busqueda, setBusqueda] = useState(q ?? '')
  useEffect(() => {
    const texto = busqueda.trim()
    if (texto === (q ?? '')) return
    const espera = setTimeout(() => actualizarUrl({ q: texto || undefined }), ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(espera)
  }, [busqueda, q, actualizarUrl])

  function aplicarFiltro(filtros: FiltrosUrl) {
    actualizarUrl({
      estado: filtros.estado,
      forma: undefined,
      requiereAtencion: filtros.requiereAtencion ? 'true' : undefined,
    })
  }

  function irAPagina(nueva: number) {
    setSearchParams((actuales) => {
      const siguiente = new URLSearchParams(actuales)
      if (nueva > 1) siguiente.set('page', String(nueva))
      else siguiente.delete('page')
      return siguiente
    })
  }

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.pageSize)) : 1

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-sm text-gray-600">
          Todos los procesos jurídicos. Una usuaria puede tener varios; cada uno tiene su propio avance, bitácora y
          documentos.
        </p>
        <label className="relative block w-full sm:w-80">
          <span className="sr-only">Buscar procesos</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={busqueda}
            maxLength={BUSQUEDA_MAX}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar por usuaria, No. interno o No. judicial"
            className={`${CLASE_CAMPO} pl-9`}
          />
        </label>
      </div>

      {resumen && <TarjetasResumen resumen={resumen} />}

      {forma && (
        <div className="flex items-center gap-3 rounded-lg bg-brand-50 px-4 py-2 text-sm text-gray-700">
          <span>
            Mostrando: <strong>Finalizados por {ETIQUETAS_FORMA_FINALIZACION[forma]}</strong>
          </span>
          <button
            type="button"
            onClick={() => actualizarUrl({ forma: undefined })}
            className="font-medium text-brand-700 hover:underline"
          >
            Quitar filtro
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((filtro) => {
          const activo = mismoFiltro(query, filtro.filtros)
          return (
            <button
              key={filtro.etiqueta}
              type="button"
              aria-pressed={activo}
              onClick={() => aplicarFiltro(filtro.filtros)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
                activo
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {filtro.etiqueta}
              {resumen && (
                <span className={`text-xs tabular-nums ${activo ? 'text-brand-100' : 'text-gray-500'}`}>
                  {filtro.contar(resumen)}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {error ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="los procesos" onReintentar={() => void recargar()} />
      ) : !datos ? (
        <Esqueleto filas={5} />
      ) : datos.items.length === 0 ? (
        <EmptyState
          Icono={Scale}
          titulo="Ningún proceso coincide con el filtro"
          descripcion="Pruebe con otro estado o quite el texto de búsqueda. Los procesos nuevos se registran desde el Área de atención o desde el expediente de la usuaria."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  <th scope="col" className="px-4 py-3">No. interno</th>
                  <th scope="col" className="px-4 py-3">Usuaria</th>
                  <th scope="col" className="px-4 py-3">Tipo de proceso</th>
                  <th scope="col" className="px-4 py-3">Avance</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3">Seguimiento</th>
                </tr>
              </thead>
              <tbody>
                {datos.items.map((proceso) => (
                  <FilaProceso key={proceso.id} proceso={proceso} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-600">
            <span className="tabular-nums">
              {datos.total} {datos.total === 1 ? 'proceso' : 'procesos'} · página {datos.page} de {totalPaginas}
            </span>
            <div className="flex gap-2">
              <Button variante="secondary" disabled={datos.page <= 1} onClick={() => irAPagina(datos.page - 1)}>
                Anterior
              </Button>
              <Button variante="secondary" disabled={datos.page >= totalPaginas} onClick={() => irAPagina(datos.page + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
