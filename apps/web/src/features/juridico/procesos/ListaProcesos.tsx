import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import {
  BUSQUEDA_MAX,
  LARGO_MINIMO_BUSQUEDA_PROCESOS,
  anioActualGT,
  hoyGT,
  type CarteraJuridico,
  type ProcesoResumen,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Switch from '../../../components/ui/Switch'
import { useToast } from '../../../components/ui/Toast'
import { listarProcesos } from '../api/juridico.api'
import { casoDesdeProceso, type ModalAudiencia } from '../audiencias/caso'
import ModalesAudiencia from '../audiencias/ModalesAudiencia'
import { useAccionProximaAudiencia } from '../audiencias/useAccionProximaAudiencia'
import { useContextoJuridico } from '../compartido/contexto'
import { ErrorVista } from '../compartido/EstadosVista'
import { useRecurso } from '../compartido/useRecurso'
import FilaProceso from './FilaProceso'
import FiltroCartera from './FiltroCartera'
import { carteraAUrl, carteraDesdeUrl, opcionesCartera } from './formato'
import ModalNumeroJudicial from '../compartido/ModalNumeroJudicial'
import Paginacion from '../compartido/Paginacion'

const ESPERA_BUSQUEDA_MS = 350
/**
 * Tabla de ancho fijo: las columnas de contenido corto tienen su ancho y "Tipo de proceso" y
 * "No. judicial" se reparten el resto por igual. Sin esto el tipo se quedaba con todo el espacio
 * sobrante y el juzgado se partía en tres líneas.
 */
const COLUMNAS: { titulo: string; ancho: string }[] = [
  { titulo: 'No. interno', ancho: 'w-[136px]' },
  { titulo: 'Usuaria', ancho: 'w-[200px]' },
  { titulo: 'Tipo de proceso', ancho: '' },
  { titulo: 'No. judicial', ancho: '' },
  { titulo: 'Último avance', ancho: 'w-[136px]' },
  // Puede ser una audiencia ya pasada que falta registrar: por eso no dice "Próxima".
  { titulo: 'Audiencia', ancho: 'w-[186px]' },
  // Sin encabezado propio: comparte el de "Audiencia" (ver ENCABEZADOS).
  { titulo: 'Acción de audiencia', ancho: 'w-[184px]' },
  // La flecha que indica que la fila abre el detalle.
  { titulo: 'Abrir', ancho: 'w-10' },
]

/**
 * Lo que ya pasó a la izquierda (último avance) y lo que viene a la derecha (audiencia y qué hacer
 * con ella). La fecha y su botón van bajo un solo encabezado: se leen como una misma cosa.
 */
const ENCABEZADOS: { titulo: string; columnas: number; clase?: string }[] = [
  { titulo: 'No. interno', columnas: 1, clase: 'sticky left-0 z-10 bg-gray-50' },
  { titulo: 'Usuaria', columnas: 1 },
  { titulo: 'Tipo de proceso', columnas: 1 },
  { titulo: 'No. judicial', columnas: 1 },
  { titulo: 'Último avance', columnas: 1 },
  { titulo: 'Audiencia', columnas: 2, clase: 'border-l border-gray-200' },
  { titulo: 'Abrir', columnas: 1 },
]

function FilasEsqueleto() {
  return (
    <>
      {Array.from({ length: 5 }, (_, indice) => (
        <tr key={indice} className="border-t border-gray-100">
          {COLUMNAS.map((columna) => (
            <td key={columna.titulo} className="px-4 py-3.5">
              <div className="h-4 animate-pulse rounded bg-gray-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function textoVacio(conBusqueda: boolean, cartera: CarteraJuridico): string {
  if (conBusqueda) return 'Ningún proceso en curso coincide con la búsqueda.'
  if (cartera === 'ANIO') return 'No hay procesos en curso iniciados este año.'
  if (cartera === 'SEGUIMIENTO') return 'No hay procesos en curso de años anteriores.'
  return 'No hay procesos en curso.'
}

/** "18 procesos en curso" o, con varias páginas, "Mostrando 16–30 de 57 procesos en curso". */
function textoConteo(pagina: number, pageSize: number, total: number, enPagina: number): string {
  const procesos = `${total} ${total === 1 ? 'proceso' : 'procesos'} en curso`
  if (total <= pageSize || enPagina === 0) return procesos
  const desde = (pagina - 1) * pageSize + 1
  return `Mostrando ${desde}–${desde + enPagina - 1} de ${procesos}`
}

/**
 * Lista de trabajo: solo procesos en trámite. "Solo asignados a mí", el año de inicio y la página
 * viven en la URL;
 * el término buscado no, para que el nombre de una usuaria no quede en el historial del navegador.
 */
export default function ListaProcesos() {
  useTituloPagina({ titulo: 'Procesos' })
  const [params, setParams] = useSearchParams()
  const mios = params.get('mios') === 'true'
  const cartera = carteraDesdeUrl(params.get('cartera'))
  const pagina = Math.max(1, Number(params.get('page')) || 1)

  const tablaRef = useRef<HTMLElement>(null)
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
    () => listarProcesos({ q: busqueda || undefined, mios: mios || undefined, cartera, page: pagina }),
    [busqueda, mios, cartera, pagina],
  )
  const { datos, error, cargando, recargar } = useRecurso(cargar)

  const { resumen, recargarResumen } = useContextoJuridico()
  const { mostrar } = useToast()
  const [modalAudiencia, setModalAudiencia] = useState<ModalAudiencia | null>(null)
  const [asignandoNumero, setAsignandoNumero] = useState<ProcesoResumen | null>(null)
  const accionAudiencia = useAccionProximaAudiencia(setModalAudiencia)
  const trasCambios = useCallback(() => {
    void recargar()
    recargarResumen()
  }, [recargar, recargarResumen])

  // Los totales del resumen cuentan todos los procesos en curso: con la lista acotada no cuadrarían.
  const opciones = opcionesCartera(anioActualGT(), mios || busqueda ? null : resumen)
  const hoy = hoyGT()

  function actualizarParams(cambios: { mios?: boolean; cartera?: CarteraJuridico; page?: number }) {
    setParams(
      (actual) => {
        const siguiente = new URLSearchParams(actual)
        if (cambios.mios !== undefined) {
          if (cambios.mios) siguiente.set('mios', 'true')
          else siguiente.delete('mios')
          siguiente.delete('page')
        }
        if (cambios.cartera !== undefined) {
          const valor = carteraAUrl(cambios.cartera)
          if (valor) siguiente.set('cartera', valor)
          else siguiente.delete('cartera')
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

  // Una página que ya no existe (otra persona finalizó procesos, o la URL quedó vieja) lleva a la última.
  const ultimaPagina = datos ? Math.max(1, Math.ceil(datos.total / datos.pageSize)) : 1
  const fueraDeRango = Boolean(datos && datos.items.length === 0 && datos.total > 0 && pagina > ultimaPagina)
  useEffect(() => {
    if (!fueraDeRango) return
    setParams(
      (actual) => {
        const siguiente = new URLSearchParams(actual)
        if (ultimaPagina > 1) siguiente.set('page', String(ultimaPagina))
        else siguiente.delete('page')
        return siguiente
      },
      { replace: true },
    )
  }, [fueraDeRango, ultimaPagina, setParams])

  const textoCorto = texto.trim().length > 0 && texto.trim().length < LARGO_MINIMO_BUSQUEDA_PROCESOS

  return (
    // Tabla de trabajo: usa el ancho disponible (las fichas y el detalle siguen en max-w-6xl para leerse).
    <div className="mx-auto max-w-[1440px] space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="relative block w-full sm:w-[400px]">
          <span className="sr-only">Buscar por usuaria, No. interno o No. judicial</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
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
        <FiltroCartera opciones={opciones} activa={cartera} onCambiar={(valor) => actualizarParams({ cartera: valor })} />
        <div className="flex items-center gap-2 text-[13px] text-gray-700 sm:ml-auto">
          <Switch encendido={mios} onChange={(valor) => actualizarParams({ mios: valor })} ariaLabel="Solo asignados a mí" />
          <span aria-hidden="true">Solo asignados a mí</span>
        </div>
      </div>
      <p className="text-[13px] text-gray-500">
        {textoCorto
          ? `Escribe al menos ${LARGO_MINIMO_BUSQUEDA_PROCESOS} caracteres.`
          : 'Procesos en curso. Los finalizados, suspendidos y abandonados se consultan en el expediente de cada usuaria.'}
      </p>

      {error && !datos ? (
        <ErrorVista mensaje={error.mensaje} sinPermiso={error.sinPermiso} recurso="los procesos" onReintentar={() => void recargar()} />
      ) : (
        <section ref={tablaRef} className="scroll-mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] table-fixed text-left">
              {/* Los anchos van en <col>: con un encabezado que abarca dos columnas, los <th> no sirven. */}
              <colgroup>
                {COLUMNAS.map((columna) => (
                  <col key={columna.titulo} className={columna.ancho} />
                ))}
              </colgroup>
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  {ENCABEZADOS.map((encabezado) => (
                    <th
                      key={encabezado.titulo}
                      scope="col"
                      colSpan={encabezado.columnas}
                      className={`whitespace-nowrap px-4 py-3 font-medium ${encabezado.clase ?? ''}`}
                    >
                      {encabezado.titulo === 'Abrir' ? <span className="sr-only">{encabezado.titulo}</span> : encabezado.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={cargando && datos ? 'opacity-60' : undefined}>
                {!datos && <FilasEsqueleto />}
                {datos?.items.map((proceso) => (
                  <FilaProceso
                    key={proceso.id}
                    proceso={proceso}
                    hoy={hoy}
                    abriendoAudiencia={Boolean(proceso.proximaAudiencia) && accionAudiencia.cargandoId === proceso.proximaAudiencia?.id}
                    onAsignarNumero={() => setAsignandoNumero(proceso)}
                    onAgendar={() => setModalAudiencia({ tipo: 'AGENDAR', caso: casoDesdeProceso(proceso) })}
                    onAccionAudiencia={() => {
                      if (proceso.proximaAudiencia) void accionAudiencia.abrir(proceso.id, proceso.proximaAudiencia)
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {datos && datos.items.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-500">
              {textoVacio(Boolean(busqueda), cartera)}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-[#fcfcfd] px-4 py-3 text-[13px] text-gray-500">
            <span className="tabular-nums">{datos ? textoConteo(datos.page, datos.pageSize, datos.total, datos.items.length) : ' '}</span>
            {datos && datos.total > datos.pageSize ? (
              <Paginacion
                etiqueta="Paginación de procesos"
                pagina={datos.page}
                pageSize={datos.pageSize}
                total={datos.total}
                onCambiar={(pagina) => {
                  actualizarParams({ page: pagina })
                  // Los botones están al pie: sin esto se vería el final de la página nueva.
                  tablaRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
                }}
              />
            ) : (
              <span>Los procesos nuevos se registran desde la ficha de la usuaria.</span>
            )}
          </div>
        </section>
      )}

      <ModalesAudiencia modal={modalAudiencia} onCambiar={setModalAudiencia} onCambios={trasCambios} />
      {asignandoNumero && (
        <ModalNumeroJudicial
          proceso={asignandoNumero}
          onCerrar={() => setAsignandoNumero(null)}
          onHecho={(mensaje) => {
            mostrar(mensaje)
            setAsignandoNumero(null)
            trasCambios()
          }}
          onConflicto={trasCambios}
        />
      )}
    </div>
  )
}
