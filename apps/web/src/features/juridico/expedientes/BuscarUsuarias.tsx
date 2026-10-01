import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FolderSearch, Search } from 'lucide-react'
import { BUSQUEDA_MAX, BUSQUEDA_USUARIAS_MIN, type UsuariaJuridicoResumen } from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Badge from '../../../components/ui/Badge'
import EmptyState from '../../../components/ui/EmptyState'
import { buscarUsuarias } from '../api/juridico.api'
import { CLASE_CAMPO } from '../compartido/campos'
import { ErrorVista, Esqueleto } from '../compartido/EstadosVista'
import { iniciales } from '../compartido/formato'
import { useRecurso } from '../compartido/useRecurso'
import { RUTAS_JURIDICO } from '../rutas'

const ESPERA_BUSQUEDA_MS = 350

function TarjetaUsuaria({ usuaria }: { usuaria: UsuariaJuridicoResumen }) {
  const { contadores } = usuaria
  return (
    <Link
      to={RUTAS_JURIDICO.usuaria(usuaria.id)}
      className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-brand-600"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
        >
          {iniciales(usuaria.nombreCompleto)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{usuaria.nombreCompleto}</p>
          <p className="text-xs text-gray-500 tabular-nums">{usuaria.dpi ? `DPI ${usuaria.dpi}` : 'Sin DPI registrado'}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tono="brand">{contadores.activos} activos</Badge>
        <Badge tono="success">{contadores.finalizados} finalizados</Badge>
        <Badge tono="warning">{contadores.abandonados} abandonados</Badge>
        {usuaria.referenciaPendiente && <Badge tono="danger">Referencia nueva</Badge>}
      </div>
    </Link>
  )
}

/** Se busca a la persona, no al proceso: de aquí se llega a todo su historial jurídico. */
export default function BuscarUsuarias() {
  useTituloPagina({ titulo: 'Expedientes' })
  const [searchParams, setSearchParams] = useSearchParams()
  const q = (searchParams.get('q') ?? '').trim().slice(0, BUSQUEDA_MAX)
  const buscable = q.length >= BUSQUEDA_USUARIAS_MIN

  const [texto, setTexto] = useState(q)
  useEffect(() => {
    const limpio = texto.trim()
    if (limpio === q) return
    const espera = setTimeout(() => setSearchParams(limpio ? { q: limpio } : {}, { replace: true }), ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(espera)
  }, [texto, q, setSearchParams])

  const cargar = useCallback(
    () => (buscable ? buscarUsuarias(q) : Promise.resolve<UsuariaJuridicoResumen[]>([])),
    [buscable, q],
  )
  const { datos: usuarias, error, recargar } = useRecurso(cargar)

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <p className="max-w-2xl text-sm text-gray-600">
        Un expediente por usuaria que agrupa todo su historial jurídico. Úselo cuando una usuaria regresa: verá lo que
        se hizo antes y podrá abrir un nuevo proceso.
      </p>

      <label className="relative block max-w-xl">
        <span className="sr-only">Buscar usuaria</span>
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          autoFocus
          value={texto}
          maxLength={BUSQUEDA_MAX}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Buscar por nombre, DPI o teléfono"
          className={`${CLASE_CAMPO} pl-9`}
        />
      </label>

      {!buscable ? (
        <EmptyState
          Icono={FolderSearch}
          titulo="Busque a la usuaria"
          descripcion={`Escriba al menos ${BUSQUEDA_USUARIAS_MIN} caracteres del nombre, DPI o teléfono.`}
        />
      ) : error ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="los expedientes" onReintentar={() => void recargar()} />
      ) : !usuarias ? (
        <Esqueleto />
      ) : usuarias.length === 0 ? (
        <EmptyState
          Icono={FolderSearch}
          titulo="Sin resultados"
          descripcion="Si la usuaria es nueva, debe ser registrada y referida por Trabajo Social."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {usuarias.map((usuaria) => (
            <TarjetaUsuaria key={usuaria.id} usuaria={usuaria} />
          ))}
        </div>
      )}
    </div>
  )
}
