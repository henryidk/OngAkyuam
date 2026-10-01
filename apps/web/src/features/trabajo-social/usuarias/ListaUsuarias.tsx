import { Search, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ETIQUETAS_AREA_ATENCION,
  ETIQUETAS_ESTADO_TS,
  ETIQUETAS_TIPO_REGISTRO,
  formatInstanteGT,
  TONO_BADGE_ESTADO_TS,
  type FiltroListaUsuarias,
} from '@akyuam/shared'
import Badge from '../../../components/ui/Badge'
import Button from '../../../components/ui/Button'
import EmptyState from '../../../components/ui/EmptyState'
import FiltrosEstado from './FiltrosEstado'
import { filtroDesdeUrl, LARGO_MINIMO_BUSQUEDA, textoAreas, textoEdad, textoHijos } from './filaUsuaria'
import { useListaUsuarias } from './useListaUsuarias'

const ESPERA_BUSQUEDA_MS = 350

/**
 * Lista de Usuarias de Trabajo Social (plan §5.4 y §12.4). Filtro y página viven en la URL
 * (se pueden recargar o compartir); el término buscado NO, para que un nombre o DPI no quede
 * en el historial del navegador.
 */
export default function ListaUsuarias() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const filtro = filtroDesdeUrl(params.get('estado'))
  const pagina = Math.max(1, Number(params.get('pagina')) || 1)

  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const siguienteBusqueda = texto.trim().length >= LARGO_MINIMO_BUSQUEDA ? texto.trim() : ''
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

  const { lista, cargando, error } = useListaUsuarias({ estado: filtro, q: busqueda, pagina })

  function actualizarParams(cambios: { estado?: FiltroListaUsuarias | null; pagina?: number }) {
    setParams(
      (actual) => {
        const siguiente = new URLSearchParams(actual)
        if (cambios.estado !== undefined) {
          if (cambios.estado) siguiente.set('estado', cambios.estado)
          else siguiente.delete('estado')
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

  function irAPagina(numero: number) {
    actualizarParams({ pagina: numero })
  }

  const totalPaginas = lista ? Math.max(1, Math.ceil(lista.total / lista.porPagina)) : 1
  const textoCorto = texto.trim().length > 0 && texto.trim().length < LARGO_MINIMO_BUSQUEDA

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <p className="text-sm text-gray-500">Todas las usuarias registradas y cómo va la atención de su caso actual.</p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FiltrosEstado
          activo={filtro}
          contadores={lista?.contadores ?? null}
          onCambiar={(valor) => actualizarParams({ estado: valor, pagina: 1 })}
        />
        <label className="relative block w-full sm:w-72">
          <span className="sr-only">Buscar por nombre, DPI o número de expediente</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            placeholder="Nombre, DPI o número (50-2026)"
            autoComplete="off"
            className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>
      {textoCorto && <p className="text-xs text-gray-500">Escribe al menos {LARGO_MINIMO_BUSQUEDA} caracteres.</p>}

      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <tr>
                {['Expediente', 'Usuaria', 'Edad', 'Registro', 'Referida a', 'Estado', 'Última actividad'].map(
                  (columna) => (
                    <th key={columna} scope="col" className="whitespace-nowrap px-4 py-2.5 text-left font-medium">
                      {columna}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className={cargando && lista ? 'opacity-60' : undefined}>
              {!lista && cargando && <FilasEsqueleto />}
              {lista?.filas.map((fila) => {
                const rutaFicha = `/trabajo-social/usuarias/${fila.usuariaId}`
                const hijos = textoHijos(fila.cantidadNinos)
                return (
                  <tr
                    key={fila.usuariaId}
                    onClick={() => navigate(rutaFicha)}
                    className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-sm font-medium tabular-nums text-brand-700">
                      <Link to={rutaFicha} onClick={(event) => event.stopPropagation()} className="hover:underline">
                        {fila.numeroExpediente}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium text-gray-900">{fila.nombreCompleto}</p>
                      {hijos && <p className="text-xs text-gray-500">{hijos}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-gray-700">
                      {textoEdad(fila.fechaNacimiento)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {ETIQUETAS_TIPO_REGISTRO[fila.tipoRegistro]}
                      {fila.enAlbergue && <span className="block text-xs text-brand-700">En albergue</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{textoAreas(fila.areasReferidas)}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge tono={TONO_BADGE_ESTADO_TS[fila.estado]}>{ETIQUETAS_ESTADO_TS[fila.estado]}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-gray-600">
                      {formatInstanteGT(fila.ultimaActividadEn)}
                      <span className="block text-xs text-gray-500">
                        {fila.ultimaActividadArea
                          ? `Referida a ${ETIQUETAS_AREA_ATENCION[fila.ultimaActividadArea]}`
                          : 'Registro del caso'}
                      </span>
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
              titulo={busqueda ? 'Ninguna usuaria coincide con la búsqueda' : 'No hay usuarias en este estado'}
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
              <Button variante="secondary" disabled={pagina <= 1} onClick={() => irAPagina(pagina - 1)}>
                Anterior
              </Button>
              <Button variante="secondary" disabled={pagina >= totalPaginas} onClick={() => irAPagina(pagina + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50/50 px-4 py-3.5">
          <p className="text-[13px] text-gray-500">
            ¿No la encuentras? Verifica primero por DPI para no duplicar el expediente.
          </p>
          <Button variante="secondary" onClick={() => navigate('/trabajo-social/registrar')}>
            Registrar usuaria
          </Button>
        </div>
      </section>
    </div>
  )
}

function FilasEsqueleto() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((indice) => (
        <tr key={indice} className="border-t border-gray-100">
          <td colSpan={7} className="px-4 py-3">
            <div className="h-5 animate-pulse rounded bg-gray-100" />
          </td>
        </tr>
      ))}
    </>
  )
}
