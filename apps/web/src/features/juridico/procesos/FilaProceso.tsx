import type { MouseEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarClock, CalendarPlus, Plus, type LucideIcon } from 'lucide-react'
import {
  CATEGORIA_POR_TIPO_PROCESO,
  ETIQUETAS_CATEGORIA_PROCESO,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  formatFechaGT,
  type ProcesoResumen,
} from '@akyuam/shared'
import ChipSeguimiento from '../compartido/ChipSeguimiento'
import { fechaDeInstante, textoAlerta } from '../compartido/formato'
import { RUTAS_JURIDICO } from '../rutas'
import { textoProximaAudiencia } from './formato'

/** Los enlaces y botones de la fila no deben abrir además el detalle. */
const sinPropagar = (evento: MouseEvent) => evento.stopPropagation()

/**
 * Dato por llenar (sin audiencia, sin No. judicial): borde punteado gris que se tiñe al pasar el
 * mouse. Se nota que es clicable sin competir con los datos de las demás filas.
 */
function BotonHueco({ Icono, onClick, children }: { Icono: LucideIcon; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={(evento) => {
        sinPropagar(evento)
        onClick()
      }}
      // `relative`: el texto sr-only (absoluto) queda dentro del scroll de la tabla y no ensancha la página.
      className="relative -my-px inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-dashed border-gray-300 px-2 text-[13px] leading-5 font-medium text-gray-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
    >
      <Icono size={14} aria-hidden="true" />
      {children}
    </button>
  )
}

interface CeldaAudienciaProps {
  proceso: ProcesoResumen
  hoy: string
  /** Se está pidiendo la audiencia completa para abrir su modal. */
  abriendo: boolean
  onAgendar: () => void
  onAccionAudiencia: () => void
}

/**
 * Sin audiencia: hueco para agendar. Antes de la hora: fecha, aviso y "Reprogramar", que aparece al
 * pasar por la fila o al llegar con el teclado (en pantallas táctiles se ve siempre). Desde la hora
 * solo cabe registrar el resultado: va siempre visible y en ámbar, porque es trabajo pendiente.
 */
function CeldaAudiencia({ proceso, hoy, abriendo, onAgendar, onAccionAudiencia }: CeldaAudienciaProps) {
  const proxima = proceso.proximaAudiencia
  if (!proxima) {
    return (
      <BotonHueco Icono={CalendarPlus} onClick={onAgendar}>
        Agendar<span className="sr-only"> audiencia</span>
      </BotonHueco>
    )
  }
  const { aviso, pendiente } = textoProximaAudiencia(proxima, hoy)
  const fecha = formatFechaGT(proxima.fecha)
  const alElegir = (evento: MouseEvent) => {
    sinPropagar(evento)
    onAccionAudiencia()
  }
  return (
    <>
      {/* Una audiencia que ya pasó va en gris: lo que importa es registrar su resultado. */}
      <Link
        to={RUTAS_JURIDICO.audienciasProceso(proceso.id, { audienciaId: proxima.id })}
        onClick={sinPropagar}
        className={`block whitespace-nowrap text-sm leading-5 tabular-nums hover:text-brand-700 hover:underline ${pendiente ? 'text-gray-500' : 'text-gray-900'}`}
      >
        {fecha} · {proxima.hora}
      </Link>
      {pendiente ? (
        <button
          type="button"
          onClick={alElegir}
          disabled={abriendo}
          className="relative mt-0.5 block whitespace-nowrap text-xs leading-4 font-semibold text-[#8a5a14] hover:underline disabled:opacity-60"
        >
          ● {abriendo ? 'Abriendo…' : 'Registrar resultado'}
          <span className="sr-only"> de la audiencia del {fecha}</span>
        </button>
      ) : (
        <p className="mt-0.5 flex items-center gap-2.5 whitespace-nowrap text-xs leading-4">
          <span className={`font-medium ${aviso === 'Hoy' ? 'text-brand-700' : 'text-gray-500'}`}>{aviso}</span>
          {/* Opacidad y no display: la fila no cambia de alto y el botón sigue en el orden del teclado. */}
          <button
            type="button"
            onClick={alElegir}
            disabled={abriendo}
            className={`relative inline-flex items-center gap-1 font-medium text-gray-500 hover:text-brand-700 hover:underline focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 ${abriendo ? 'opacity-100' : 'opacity-0'}`}
          >
            <CalendarClock size={12} aria-hidden="true" />
            {abriendo ? 'Abriendo…' : 'Reprogramar'}
            <span className="sr-only"> la audiencia del {fecha}</span>
          </button>
        </p>
      )}
    </>
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
    <tr onClick={() => navigate(destino)} className="group cursor-pointer border-t border-gray-100 hover:bg-gray-50">
      {/* Primera columna fija al desplazar la tabla: lleva su propio fondo. */}
      <td className="sticky left-0 z-10 bg-white px-4 py-3 align-top group-hover:bg-gray-50">
        <Link
          to={destino}
          onClick={sinPropagar}
          aria-label={proceso.codigo}
          className="block whitespace-nowrap text-sm leading-5 font-semibold text-brand-700 tabular-nums hover:underline"
        >
          {expediente}
        </Link>
        <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-xs leading-4 text-gray-500">
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
      <td className="px-4 py-3 align-top">
        <p className="text-sm leading-5 font-medium text-gray-900">{proceso.usuaria.nombreCompleto}</p>
      </td>
      <td className="px-4 py-3 align-top">
        <p className="text-sm leading-5 text-gray-900">{ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo]}</p>
        <p className="mt-0.5 text-xs leading-4 text-gray-500">
          {ETIQUETAS_CATEGORIA_PROCESO[CATEGORIA_POR_TIPO_PROCESO[proceso.tipo]]} ·{' '}
          {proceso.abogada?.nombre ?? 'Sin abogada asignada'}
        </p>
      </td>
      <td className="px-4 py-3 align-top">
        {proceso.numeroJudicial ? (
          // Suele traer el juzgado o la fiscalía junto al número: se parte en líneas con un ancho
          // acotado y, si es muy largo, se recorta a 3 líneas (completo en el title y en el detalle).
          <p title={proceso.numeroJudicial} className="line-clamp-3 text-sm leading-5 break-words text-gray-900">
            {proceso.numeroJudicial}
          </p>
        ) : (
          <BotonHueco Icono={Plus} onClick={onAsignarNumero}>
            Agregar<span className="sr-only"> número judicial</span>
          </BotonHueco>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <CeldaAudiencia
          proceso={proceso}
          hoy={hoy}
          abriendo={abriendoAudiencia}
          onAgendar={onAgendar}
          onAccionAudiencia={onAccionAudiencia}
        />
      </td>
      <td className="px-4 py-3 align-top">
        {/* La cabecera ya dice "Última actuación": aquí solo la fecha. */}
        <p className="whitespace-nowrap text-sm leading-5 text-gray-700 tabular-nums">{fechaDeInstante(proceso.ultimaActuacionEn)}</p>
        {alerta && <p className="mt-0.5 text-xs leading-4 font-medium text-[#8a5a14]">● {alerta}</p>}
      </td>
    </tr>
  )
}
