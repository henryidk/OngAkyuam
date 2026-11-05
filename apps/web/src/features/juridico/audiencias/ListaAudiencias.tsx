import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  LARGO_MINIMO_BUSQUEDA_PROCESOS,
  hoyGT,
  buscarAudienciasSchema,
  type AccionAudiencia,
  type AudienciaFilaDto,
  type AudienciasPaginadas,
  type VistaAudiencias,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import { listarAudiencias, obtenerResumenAudiencias } from '../api/audiencias.api'
import { useContextoJuridico } from '../compartido/contexto'
import { ErrorVista } from '../compartido/EstadosVista'
import Paginacion from '../../../components/ui/Paginacion'
import { useRecurso } from '../compartido/useRecurso'
import { RUTAS_JURIDICO } from '../rutas'
import type { ModalAudiencia } from './caso'
import { aplicarCambios, leerFiltros, queryDesdeFiltros, textoRangoProximas, type FiltrosAudiencias as Filtros } from './filtros'
import FiltrosAudiencias from './FiltrosAudiencias'
import ModalesAudiencia from './ModalesAudiencia'
import PestanasResumen from './PestanasResumen'
import TablaAudiencias from './TablaAudiencias'

const ESPERA_BUSQUEDA_MS = 350

const VACIO: AudienciasPaginadas = { items: [], page: 1, pageSize: 1, total: 0 }

const SIN_RESULTADOS: Record<VistaAudiencias, string> = {
  proximas: 'No hay audiencias próximas.',
  pendientes: 'No hay audiencias pendientes de resultado.',
  historial: 'No hay audiencias en ese rango de fechas.',
}

/** "Mostrando 21–40 de 85 audiencias". */
function textoConteo(pagina: number, pageSize: number, total: number, enPagina: number): string {
  const audiencias = `${total} ${total === 1 ? 'audiencia' : 'audiencias'}`
  if (enPagina === 0) return audiencias
  const desde = (pagina - 1) * pageSize + 1
  return `Mostrando ${desde}–${desde + enPagina - 1} de ${audiencias}`
}

/**
 * Agenda de audiencias de todo el equipo. Pestaña, responsable, rango y página viven en la URL;
 * el texto buscado no, para que el nombre de una usuaria no quede en el historial del navegador.
 */
export default function ListaAudiencias() {
  useTituloPagina({ titulo: 'Audiencias' })
  const { recargarResumen } = useContextoJuridico()
  const [params, setParams] = useSearchParams()
  const hoy = hoyGT()
  const filtros = useMemo(() => leerFiltros(params, hoy), [params, hoy])
  const [modal, setModal] = useState<ModalAudiencia | null>(null)

  const tablaRef = useRef<HTMLElement>(null)
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
  const validacion = buscarAudienciasSchema.safeParse(query)
  const errorRango = validacion.success ? null : (validacion.error.issues[0]?.message ?? 'Revise el rango de fechas')
  const cargar = useCallback(
    () => (errorRango ? Promise.resolve(VACIO) : listarAudiencias(query)),
    [query, errorRango],
  )
  const { datos, error, cargando, recargar } = useRecurso(cargar)

  // Las cifras siguen el filtro de responsable de la lista, nunca el texto buscado.
  const responsableId = filtros.mias ? undefined : filtros.responsableId || undefined
  const cargarResumen = useCallback(
    () => obtenerResumenAudiencias({ responsableId, mias: filtros.mias ? 'true' : undefined }),
    [responsableId, filtros.mias],
  )
  const { datos: cifras, recargar: recargarCifras } = useRecurso(cargarResumen)

  const onAccion = useCallback((accion: AccionAudiencia, audiencia: AudienciaFilaDto) => setModal({ tipo: accion, audiencia }), [])
  const onCambios = useCallback(() => {
    void recargar()
    void recargarCifras()
    recargarResumen()
  }, [recargar, recargarCifras, recargarResumen])

  // Una página que ya no existe (se registraron resultados, o la URL quedó vieja) lleva a la última.
  const ultimaPagina = datos ? Math.max(1, Math.ceil(datos.total / datos.pageSize)) : 1
  const fueraDeRango = Boolean(datos && datos.items.length === 0 && datos.total > 0 && filtros.page > ultimaPagina)
  useEffect(() => {
    if (fueraDeRango) cambiar({ page: ultimaPagina })
  }, [fueraDeRango, ultimaPagina, cambiar])

  const textoCorto = texto.trim().length > 0 && texto.trim().length < LARGO_MINIMO_BUSQUEDA_PROCESOS

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PestanasResumen vista={filtros.vista} resumen={cifras} onElegir={(vista) => cambiar({ vista })} />
      {filtros.vista === 'pendientes' && (
        <p className="text-sm text-gray-600">
          Estas audiencias ya pasaron. Registra qué ocurrió en cada una para que el proceso quede al día; las más antiguas van primero.
        </p>
      )}
      <FiltrosAudiencias filtros={filtros} texto={texto} onTexto={setTexto} onCambiar={cambiar} />
      {filtros.rangoProximas && (
        // Llega así desde la notificación ("Mañana: 2 audiencias"): se dice qué se está viendo y cómo volver.
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3.5 py-2 text-[13px] text-brand-800">
          <span>
            Mostrando solo las audiencias <strong className="font-semibold">{textoRangoProximas(filtros.rangoProximas, hoy)}</strong>.
          </span>
          <button
            type="button"
            onClick={() => cambiar({ desde: '', hasta: '' })}
            className="font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Ver todas las próximas
          </button>
        </div>
      )}
      {textoCorto && <p className="text-xs text-gray-500">Escribe al menos {LARGO_MINIMO_BUSQUEDA_PROCESOS} caracteres.</p>}
      {errorRango && (
        <p role="alert" className="text-sm text-red-600">
          {errorRango}
        </p>
      )}

      {error && !datos ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="las audiencias" onReintentar={() => void recargar()} />
      ) : (
        <section ref={tablaRef} className="scroll-mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]">
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
          {datos && datos.total > datos.pageSize && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-[#fcfcfd] px-4 py-3 text-[13px] text-gray-500">
              <span className="tabular-nums">{textoConteo(datos.page, datos.pageSize, datos.total, datos.items.length)}</span>
              <Paginacion
                etiqueta="Paginación de audiencias"
                pagina={datos.page}
                pageSize={datos.pageSize}
                total={datos.total}
                onCambiar={(page) => {
                  cambiar({ page })
                  // Los botones están al pie: sin esto se vería el final de la página nueva.
                  tablaRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
                }}
              />
            </div>
          )}
        </section>
      )}

      <ModalesAudiencia modal={modal} onCambiar={setModal} onCambios={onCambios} />
    </div>
  )
}
