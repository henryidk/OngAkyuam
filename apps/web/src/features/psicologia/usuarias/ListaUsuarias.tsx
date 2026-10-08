import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Users } from 'lucide-react'
import {
  ETIQUETAS_FILTRO_USUARIAS_PSICOLOGIA,
  FILTROS_USUARIAS_PSICOLOGIA,
  formatInstanteGT,
  LARGO_MINIMO_BUSQUEDA_USUARIAS,
  type FilaUsuariaPsicologia,
  type FiltroUsuariasPsicologia,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Button from '../../../components/ui/Button'
import EmptyState from '../../../components/ui/EmptyState'
import { ErrorVista } from '../../../components/ui/EstadosVista'
import { useRecurso } from '../../../lib/useRecurso'
import { rangoEdadCorto } from '../../trabajo-social/usuarias/filaUsuaria'
import { listarUsuarias } from '../api/psicologia.api'
import { RUTAS_PSICOLOGIA } from '../rutas'

const ESPERA_BUSQUEDA_MS = 350
const CLASE_PILDORA = 'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium'

const PILDORA_PROCESO: Record<NonNullable<FilaUsuariaPsicologia['estadoProceso']>, { etiqueta: string; clase: string }> = {
  ACTIVO: { etiqueta: 'En proceso', clase: 'bg-[#f7f3fc] text-[#7346a5]' },
  CERRADO: { etiqueta: 'Cerrado', clase: 'bg-[#e7f1ea] text-[#2f6b3f]' },
}

const COLUMNAS = ['Expediente', 'Usuaria', 'Edad', 'Procesos', 'Última actividad']

function filtroDesdeUrl(valor: string | null): FiltroUsuariasPsicologia | undefined {
  return FILTROS_USUARIAS_PSICOLOGIA.find((filtro) => filtro === valor)
}

/**
 * Usuarias que Trabajo Social refirió a Psicología. Filtro y página viven en la URL; el término
 * buscado no, para que un nombre o DPI no quede en el historial del navegador.
 */
export default function ListaUsuarias() {
  useTituloPagina({ titulo: 'Usuarias' })
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const filtro = filtroDesdeUrl(params.get('filtro'))
  const pagina = Math.max(1, Number(params.get('pagina')) || 1)

  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const siguienteBusqueda = texto.trim().length >= LARGO_MINIMO_BUSQUEDA_USUARIAS ? texto.trim() : ''
  useEffect(() => {
    if (siguienteBusqueda === busqueda) return
    const temporizador = setTimeout(() => {
      setBusqueda(siguienteBusqueda)
      // Una búsqueda nueva siempre empieza en la primera página.
      setParams(
        (actual) => {
          const siguiente = new URLSearchParams(actual)
          siguiente.delete('pagina')
          return siguiente
        },
        { replace: true },
      )
    }, ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(temporizador)
  }, [siguienteBusqueda, busqueda, setParams])

  const cargar = useCallback(
    () => listarUsuarias({ filtro, q: busqueda || undefined, pagina }),
    [filtro, busqueda, pagina],
  )
  const { datos: lista, error, cargando, recargar } = useRecurso(cargar)

  function actualizarParams(cambios: { filtro?: FiltroUsuariasPsicologia | null; pagina?: number }) {
    setParams(
      (actual) => {
        const siguiente = new URLSearchParams(actual)
        if (cambios.filtro !== undefined) {
          if (cambios.filtro) siguiente.set('filtro', cambios.filtro)
          else siguiente.delete('filtro')
        }
        if (cambios.pagina !== undefined) {
          if (cambios.pagina > 1) siguiente.set('pagina', String(cambios.pagina))
          else siguiente.delete('pagina')
        }
        return siguiente
      },
      { replace: true },
    )
  }

  const totalPaginas = lista ? Math.max(1, Math.ceil(lista.total / lista.porPagina)) : 1
  const textoCorto = texto.trim().length > 0 && texto.trim().length < LARGO_MINIMO_BUSQUEDA_USUARIAS
  const chips: { valor: FiltroUsuariasPsicologia | null; etiqueta: string; total: number | undefined }[] = [
    { valor: null, etiqueta: 'Todas', total: lista?.contadores.TODAS },
    ...FILTROS_USUARIAS_PSICOLOGIA.map((valor) => ({
      valor,
      etiqueta: ETIQUETAS_FILTRO_USUARIAS_PSICOLOGIA[valor],
      total: lista?.contadores[valor],
    })),
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <p className="max-w-2xl text-sm text-gray-600">
        Usuarias que Trabajo Social refirió a Psicología. Abre una para ver su ficha: procesos, datos del caso,
        documentos y referencias.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => {
            const activo = (filtro ?? null) === chip.valor
            return (
              <button
                key={chip.etiqueta}
                type="button"
                aria-pressed={activo}
                onClick={() => actualizarParams({ filtro: chip.valor, pagina: 1 })}
                className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${
                  activo
                    ? 'border-[#7346a5] bg-[#f7f3fc] text-[#5b3985]'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {chip.etiqueta}
                {chip.total !== undefined && <span className="ml-1.5 tabular-nums opacity-70">{chip.total}</span>}
              </button>
            )
          })}
        </div>
        <label className="relative block w-full sm:w-[360px]">
          <span className="sr-only">Buscar por nombre, DPI o expediente</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            placeholder="Buscar por nombre, DPI o expediente"
            autoComplete="off"
            className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>
      {textoCorto && (
        <p className="text-xs text-gray-500">Escribe al menos {LARGO_MINIMO_BUSQUEDA_USUARIAS} caracteres.</p>
      )}

      {error && !lista ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="la lista de usuarias" onReintentar={() => void recargar()} />
      ) : (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  {COLUMNAS.map((columna) => (
                    <th key={columna} scope="col" className="whitespace-nowrap px-4 py-2.5 text-left font-medium">
                      {columna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={cargando && lista ? 'opacity-60' : undefined}>
                {!lista && cargando && <FilasEsqueleto />}
                {lista?.filas.map((fila) => {
                  const rutaFicha = RUTAS_PSICOLOGIA.usuaria(fila.usuariaId)
                  const pildora = fila.estadoProceso ? PILDORA_PROCESO[fila.estadoProceso] : null
                  return (
                    <tr
                      key={fila.usuariaId}
                      onClick={() => navigate(rutaFicha)}
                      className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-sm font-medium tabular-nums text-[#5b3985]">
                        <Link to={rutaFicha} onClick={(event) => event.stopPropagation()} className="hover:underline">
                          {fila.expedienteNumero}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <p className="font-medium text-gray-900">{fila.nombreCompleto}</p>
                        {fila.dpi && <p className="text-xs tabular-nums text-gray-500">DPI {fila.dpi}</p>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-gray-700">
                        {fila.edad} · {rangoEdadCorto(fila.edad)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap gap-1.5">
                          {fila.referenciaPendiente && (
                            <span className={`${CLASE_PILDORA} bg-[#fef3c7] text-[#b45309]`}>Referencia nueva</span>
                          )}
                          {pildora && <span className={`${CLASE_PILDORA} ${pildora.clase}`}>{pildora.etiqueta}</span>}
                          {!pildora && !fila.referenciaPendiente && <span className="text-gray-400">—</span>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-gray-600">
                        {formatInstanteGT(fila.ultimaActividadEn)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {lista && lista.filas.length === 0 && (
            <div className="p-4">
              <EmptyState
                Icono={Users}
                titulo={busqueda ? 'Ninguna usuaria coincide.' : 'No hay usuarias en este filtro.'}
                descripcion={busqueda ? 'Prueba con el DPI o el número de expediente.' : undefined}
              />
            </div>
          )}

          {lista && totalPaginas > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500">
              <span className="tabular-nums">
                Página {lista.pagina} de {totalPaginas} · {lista.total} usuarias
              </span>
              <div className="flex gap-2">
                <Button variante="secondary" disabled={pagina <= 1} onClick={() => actualizarParams({ pagina: pagina - 1 })}>
                  Anterior
                </Button>
                <Button
                  variante="secondary"
                  disabled={pagina >= totalPaginas}
                  onClick={() => actualizarParams({ pagina: pagina + 1 })}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function FilasEsqueleto() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((indice) => (
        <tr key={indice} className="border-t border-gray-100">
          <td colSpan={COLUMNAS.length} className="px-4 py-3">
            <div className="h-5 animate-pulse rounded bg-gray-100" />
          </td>
        </tr>
      ))}
    </>
  )
}
