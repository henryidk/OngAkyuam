import type { MouseEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarClock, CalendarPlus, ChevronRight, ClipboardCheck, Loader2, Plus, type LucideIcon } from 'lucide-react'
import {
  CATEGORIA_POR_TIPO_PROCESO,
  ETIQUETAS_CATEGORIA_PROCESO,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  formatFechaGT,
  type ProcesoResumen,
} from '@akyuam/shared'
import ChipSeguimiento from '../compartido/ChipSeguimiento'
import { fechaDeInstante, textoAlerta } from '../compartido/formato'
import { formatHora12 } from '../compartido/hora12'
import { textoCuando } from '../detalle/formatoBitacora'
import { RUTAS_JURIDICO } from '../rutas'
import { textoProximaAudiencia } from './formato'

/** Los enlaces y botones de la fila no deben abrir además el detalle. */
const sinPropagar = (evento: MouseEvent) => evento.stopPropagation()

/** Anillo de foco visible para quien navega con el teclado. */
const CLASE_FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1'

/**
 * Dato por llenar (sin audiencia, sin No. judicial): borde punteado gris que se tiñe al pasar el
 * mouse. Se nota que es clicable sin competir con los datos de las demás filas. La etiqueta dice
 * la acción completa ("Agendar audiencia"): quien está empezando no tiene que deducirla de la columna.
 */
function BotonHueco({ Icono, onClick, children }: { Icono: LucideIcon; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={(evento) => {
        sinPropagar(evento)
        onClick()
      }}
      className={`-my-[5px] inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-dashed border-gray-300 px-2.5 py-1 text-[13px] leading-5 font-medium text-gray-600 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 ${CLASE_FOCO}`}
    >
      <Icono size={15} aria-hidden="true" />
      {children}
    </button>
  )
}

const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

/** Color del aviso según la urgencia: ámbar si ya pasó sin resultado, morado si es hoy, gris si falta. */
function colorAviso(pendiente: boolean, aviso: string): string {
  if (pendiente) return 'text-[#8a5a14]'
  return aviso === 'Hoy' ? 'text-brand-700' : 'text-gray-500'
}

/** Fecha y hora de la próxima audiencia (enlace a ella) y cuánto falta o desde cuándo pasó. */
function CeldaAudiencia({ proceso, hoy }: { proceso: ProcesoResumen; hoy: string }) {
  const proxima = proceso.proximaAudiencia
  if (!proxima) return <p className="text-sm leading-5 text-gray-400">Sin audiencia</p>
  const { aviso, pendiente } = textoProximaAudiencia(proxima, hoy)
  // Si ya pasó, la columna Acción dice qué falta; aquí, desde cuándo ("Hace 2 días").
  const cuando = pendiente ? capitalizar(textoCuando(proxima.fecha, hoy)) : aviso
  return (
    <>
      <Link
        to={RUTAS_JURIDICO.audienciasProceso(proceso.id, { audienciaId: proxima.id })}
        onClick={sinPropagar}
        className={`block whitespace-nowrap rounded text-sm leading-5 text-gray-900 tabular-nums hover:text-brand-700 hover:underline ${CLASE_FOCO}`}
      >
        {formatFechaGT(proxima.fecha)} · {formatHora12(proxima.hora)}
      </Link>
      <p className={`mt-0.5 whitespace-nowrap text-[13px] leading-5 font-medium ${colorAviso(pendiente, aviso)}`}>{cuando}</p>
    </>
  )
}

interface CeldaAccionProps {
  proceso: ProcesoResumen
  hoy: string
  /** Se está pidiendo la audiencia completa para abrir su modal. */
  abriendo: boolean
  onAgendar: () => void
  onAccionAudiencia: () => void
}

/**
 * La única acción de audiencia que cabe en cada momento, siempre en la misma columna y siempre
 * visible: Agendar (no hay), Reprogramar (aún no llega) o Registrar resultado (ya pasó). Antes
 * Reprogramar solo aparecía al pasar el mouse, y quien no conoce ese gesto no sabía que existía.
 */
function CeldaAccion({ proceso, hoy, abriendo, onAgendar, onAccionAudiencia }: CeldaAccionProps) {
  const proxima = proceso.proximaAudiencia
  if (!proxima) {
    return (
      <BotonHueco Icono={CalendarPlus} onClick={onAgendar}>
        Agendar audiencia
      </BotonHueco>
    )
  }
  const { pendiente } = textoProximaAudiencia(proxima, hoy)
  const Icono = abriendo ? Loader2 : pendiente ? ClipboardCheck : CalendarClock
  return (
    <button
      type="button"
      onClick={(evento) => {
        sinPropagar(evento)
        onAccionAudiencia()
      }}
      disabled={abriendo}
      // Pendiente en ámbar suave, no sólido: suelen ser varias filas a la vez y en sólido la columna
      // entera se volvía una franja café que tapaba el resto de la tabla.
      className={`-my-[5px] inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-[13px] leading-5 font-medium transition-colors disabled:cursor-wait disabled:opacity-70 ${CLASE_FOCO} ${
        pendiente
          ? 'border-[#e6cd9f] bg-[#fdf6ea] text-[#8a5a14] hover:border-[#8a5a14] hover:bg-[#f8ead1]'
          : 'border-gray-300 bg-white text-gray-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700'
      }`}
    >
      <Icono size={15} aria-hidden="true" className={abriendo ? 'animate-spin' : undefined} />
      {abriendo ? 'Abriendo…' : pendiente ? 'Registrar resultado' : 'Reprogramar'}
      <span className="sr-only"> de la audiencia del {formatFechaGT(proxima.fecha)}</span>
    </button>
  )
}

interface FilaProcesoProps {
  proceso: ProcesoResumen
  /** Fecha de hoy en Guatemala, una sola vez por lista. */
  hoy: string
  /** Se está pidiendo la próxima audiencia de este proceso para abrir su modal. */
  abriendoAudiencia: boolean
  onAsignarNumero: () => void
  onAgendar: () => void
  /** Reprogramar la próxima audiencia o registrar su resultado (`accionProximaAudiencia`). */
  onAccionAudiencia: () => void
}

export default function FilaProceso({
  proceso,
  hoy,
  abriendoAudiencia,
  onAsignarNumero,
  onAgendar,
  onAccionAudiencia,
}: FilaProcesoProps) {
  const alerta = textoAlerta(proceso)
  const navigate = useNavigate()
  const destino = RUTAS_JURIDICO.proceso(proceso.id)
  // "05-2026 · Proceso 2": el expediente es el dato principal; el número de proceso, el secundario.
  const [expediente, etiquetaProceso] = proceso.codigo.split(' · ')
  return (
    // Toda la fila abre el detalle; el enlace del código es el que recibe el foco del teclado.
    // Todas las celdas abren con una línea text-sm/leading-5 para que la fila se lea a una misma altura.
    <tr onClick={() => navigate(destino)} className="group cursor-pointer border-t border-gray-100 transition-colors hover:bg-gray-50">
      {/* Primera columna fija al desplazar la tabla: lleva su propio fondo. */}
      <td className="sticky left-0 z-10 bg-white px-4 py-3.5 align-top group-hover:bg-gray-50">
        <Link
          to={destino}
          onClick={sinPropagar}
          aria-label={proceso.codigo}
          className="block whitespace-nowrap text-sm leading-5 font-semibold text-brand-700 tabular-nums hover:underline"
        >
          {expediente}
        </Link>
        <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[13px] leading-5 text-gray-500">
          {etiquetaProceso}
          {/* La lista solo trae procesos en trámite: casi todos van "En proceso"; se marca la excepción. */}
          {proceso.fase === 'INICIADO' && (
            <span className="rounded bg-gray-100 px-1.5 text-[11px] font-medium text-gray-600">Iniciado</span>
          )}
        </p>
        {proceso.esSeguimiento && (
          <div className="mt-1.5">
            <ChipSeguimiento fechaInicio={proceso.fechaInicio} />
          </div>
        )}
      </td>
      <td className="px-4 py-3.5 align-top">
        <p className="text-sm leading-5 font-medium text-gray-900">{proceso.usuaria.nombreCompleto}</p>
      </td>
      <td className="px-4 py-3.5 align-top">
        <p className="text-sm leading-5 text-gray-900">{ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo]}</p>
        <p className="mt-0.5 text-[13px] leading-5 text-gray-500">
          {ETIQUETAS_CATEGORIA_PROCESO[CATEGORIA_POR_TIPO_PROCESO[proceso.tipo]]} ·{' '}
          {[proceso.abogada?.nombre, proceso.procuradora?.nombre].filter(Boolean).join(' y ') || 'Sin equipo asignado'}
        </p>
      </td>
      <td className="px-4 py-3.5 align-top">
        {proceso.numeroJudicial ? (
          // Suele traer el juzgado o la fiscalía junto al número: se parte en líneas con un ancho
          // acotado y, si es muy largo, se recorta a 3 líneas (completo en el title y en el detalle).
          <p title={proceso.numeroJudicial} className="line-clamp-3 text-sm leading-5 break-words text-gray-900">
            {proceso.numeroJudicial}
          </p>
        ) : (
          <BotonHueco Icono={Plus} onClick={onAsignarNumero}>
            Agregar número
          </BotonHueco>
        )}
      </td>
      <td className="px-4 py-3.5 align-top">
        {/* La cabecera ya dice "Último avance": aquí solo la fecha. */}
        <p className="whitespace-nowrap text-sm leading-5 text-gray-700 tabular-nums">{fechaDeInstante(proceso.ultimaActuacionEn)}</p>
        {alerta && <p className="mt-0.5 text-[13px] leading-5 font-medium text-[#8a5a14]">● {alerta}</p>}
      </td>
      {/* Audiencia y su acción, juntas bajo un mismo encabezado: fecha a la izquierda, qué hacer a la derecha. */}
      <td className="border-l border-gray-100 py-3.5 pl-4 pr-2 align-top">
        <CeldaAudiencia proceso={proceso} hoy={hoy} />
      </td>
      <td className="py-3.5 pl-2 pr-2 align-top">
        <CeldaAccion
          proceso={proceso}
          hoy={hoy}
          abriendo={abriendoAudiencia}
          onAgendar={onAgendar}
          onAccionAudiencia={onAccionAudiencia}
        />
      </td>
      {/* Señal de que la fila entera abre el detalle, como en las listas de un teléfono. */}
      <td className="py-3.5 pr-3 align-top">
        <ChevronRight
          size={18}
          aria-hidden="true"
          className="mt-px text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600"
        />
      </td>
    </tr>
  )
}
