import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  LARGO_MINIMO_BUSQUEDA_PROCESOS,
  hoyGT,
  listarAudienciasQuerySchema,
  type AccionAudiencia,
  type AudienciaFilaDto,
  type AudienciasPaginadas,
  type VistaAudiencias,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Button from '../../../components/ui/Button'
import { listarAudiencias } from '../api/audiencias.api'
import { useContextoJuridico } from '../compartido/contexto'
import { ErrorVista } from '../compartido/EstadosVista'
import { useRecurso } from '../compartido/useRecurso'
import { RUTAS_JURIDICO } from '../rutas'
import type { ModalAudiencia } from './caso'
import { aplicarCambios, leerFiltros, queryDesdeFiltros, type FiltrosAudiencias as Filtros } from './filtros'
import FiltrosAudiencias from './FiltrosAudiencias'
import ModalesAudiencia from './ModalesAudiencia'
import TablaAudiencias from './TablaAudiencias'

const ESPERA_BUSQUEDA_MS = 350

const VACIO: AudienciasPaginadas = { items: [], page: 1, pageSize: 1, total: 0 }

const SIN_RESULTADOS: Record<VistaAudiencias, string> = {
  proximas: 'No hay audiencias próximas.',
  pendientes: 'No hay audiencias pendientes de resultado.',
  historial: 'No hay audiencias en ese rango de fechas.',
}

function Pestanas({ vista, pendientes, onElegir }: { vista: VistaAudiencias; pendientes: number | null; onElegir: (vista: VistaAudiencias) => void }) {
  const opciones: [VistaAudiencias, string][] = [
    ['proximas', 'Próximas'],
    ['pendientes', pendientes ? `Pendientes de resultado (${pendientes})` : 'Pendientes de resultado'],
    ['historial', 'Historial'],
  ]
  return (
    <div role="tablist" aria-label="Audiencias" className="flex gap-5 border-b border-gray-200">
      {opciones.map(([valor, etiqueta]) => (
        <button
          key={valor}
          type="button"
          role="tab"
          aria-selected={vista === valor}
          onClick={() => onElegir(valor)}
          className={`-mb-px border-b-2 px-0.5 pb-2.5 text-[13.5px] font-medium ${
            vista === valor ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          {etiqueta}
        </button>
      ))}
    </div>
  )
}

/**
 * Agenda de audiencias de todo el equipo. Pestaña, responsable, rango y página viven en la URL;
 * el texto buscado no, para que el nombre de una usuaria no quede en el historial del navegador.
 */
export default function ListaAudiencias() {
  useTituloPagina({ titulo: 'Audiencias' })
  const { resumen, recargarResumen } = useContextoJuridico()
  const [params, setParams] = useSearchParams()
  const filtros = useMemo(() => leerFiltros(params, hoyGT()), [params])
  const [modal, setModal] = useState<ModalAudiencia | null>(null)

  const [texto, setTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const cambiar = useCallback(
    (cambios: Partial<Filtros>) => setParams((actual) => aplicarCambios(actual, cambios), { replace: true }),
    [setParams],
  )

  const siguienteBusqueda = texto.trim().length >= LARGO_MINIMO_BUSQUEDA_PROCESOS ? texto.trim() : ''
  useEffect(() => {
    if (siguienteBusqueda === busqueda) return
    const temporizador = setTimeout(() => {
      setBusqueda(siguienteBusqueda)
      // Una búsqueda nueva siempre empieza en la primera página.
      cambiar({})
    }, ESPERA_BUSQUEDA_MS)
    return () => clearTimeout(temporizador)
  }, [siguienteBusqueda, busqueda, cambiar])

  const query = useMemo(() => queryDesdeFiltros(filtros, busqueda), [filtros, busqueda])
  // Un rango editado a mano (más de un año, invertido) se explica aquí en vez de pedirlo.
  const validacion = listarAudienciasQuerySchema.safeParse(query)
  const errorRango = validacion.success ? null : (validacion.error.issues[0]?.message ?? 'Revise el rango de fechas')
  const cargar = useCallback(
    () => (errorRango ? Promise.resolve(VACIO) : listarAudiencias(query)),
    [query, errorRango],
  )
  const { datos, error, cargando, recargar } = useRecurso(cargar)

  const onAccion = useCallback((accion: AccionAudiencia, audiencia: AudienciaFilaDto) => setModal({ tipo: accion, audiencia }), [])
  const onCambios = useCallback(() => {
    void recargar()
    recargarResumen()
  }, [recargar, recargarResumen])

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.pageSize)) : 1
  const textoCorto = texto.trim().length > 0 && texto.trim().length < LARGO_MINIMO_BUSQUEDA_PROCESOS

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Pestanas vista={filtros.vista} pendientes={resumen?.audienciasPendientes ?? null} onElegir={(vista) => cambiar({ vista })} />
      <FiltrosAudiencias filtros={filtros} texto={texto} onTexto={setTexto} onCambiar={cambiar} />
      {textoCorto && <p className="text-xs text-gray-500">Escribe al menos {LARGO_MINIMO_BUSQUEDA_PROCESOS} caracteres.</p>}
      {errorRango && (
        <p role="alert" className="text-sm text-red-600">
          {errorRango}
        </p>
      )}

      {error && !datos ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="las audiencias" onReintentar={() => void recargar()} />
      ) : (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]">
          <TablaAudiencias items={datos?.items ?? null} vista={filtros.vista} atenuada={cargando && Boolean(datos)} onAccion={onAccion} />
          {datos && datos.items.length === 0 && !errorRango && (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              <p>{busqueda ? 'Ninguna audiencia coincide con la búsqueda.' : SIN_RESULTADOS[filtros.vista]}</p>
              {filtros.vista === 'proximas' && !busqueda && (
                <p className="mt-1">
                  Las audiencias se agendan desde cada proceso en{' '}
                  <Link to={RUTAS_JURIDICO.procesos()} className="font-medium text-brand-700 hover:underline">
                    Procesos
                  </Link>
                  .
                </p>
              )}
            </div>
          )}
          {datos && totalPaginas > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-[#fcfcfd] px-4 py-3.5 text-[13px] text-gray-500">
              <span className="tabular-nums">
                {datos.total} {datos.total === 1 ? 'audiencia' : 'audiencias'} · página {datos.page} de {totalPaginas}
              </span>
              <div className="flex gap-2">
                <Button variante="secondary" disabled={datos.page <= 1} onClick={() => cambiar({ page: datos.page - 1 })}>
                  Anterior
                </Button>
                <Button variante="secondary" disabled={datos.page >= totalPaginas} onClick={() => cambiar({ page: datos.page + 1 })}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      <ModalesAudiencia modal={modal} onCambiar={setModal} onCambios={onCambios} />
    </div>
  )
}
