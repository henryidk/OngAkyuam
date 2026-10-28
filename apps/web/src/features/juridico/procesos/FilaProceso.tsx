import type { MouseEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import {
  CATEGORIA_POR_TIPO_PROCESO,
  ETIQUETAS_CATEGORIA_PROCESO,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  formatFechaGT,
  type ProcesoResumen,
} from '@akyuam/shared'
import { BarraAvanceCompacta } from '../compartido/BarraAvance'
import ChipSeguimiento from '../compartido/ChipSeguimiento'
import { fechaDeInstante, textoAlerta } from '../compartido/formato'
import { RUTAS_JURIDICO } from '../rutas'
import { textoProximaAudiencia } from './formato'

/** Los enlaces y botones de la fila no deben abrir además el detalle. */
const sinPropagar = (evento: MouseEvent) => evento.stopPropagation()

function BotonFila({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={(evento) => {
        sinPropagar(evento)
        onClick()
      }}
      // `relative`: el texto sr-only (absoluto) queda dentro del scroll de la tabla y no ensancha la página.
      className="relative inline-flex items-center gap-1 whitespace-nowrap rounded text-[13px] font-medium text-brand-700 hover:underline"
    >
      <Plus size={14} aria-hidden="true" />
      {children}
    </button>
  )
}

function CeldaProximaAudiencia({ proceso, hoy, onAgendar }: { proceso: ProcesoResumen; hoy: string; onAgendar: () => void }) {
  const proxima = proceso.proximaAudiencia
  if (!proxima) {
    return (
      <BotonFila onClick={onAgendar}>
        Agendar<span className="sr-only"> audiencia</span>
      </BotonFila>
    )
  }
  const { aviso, pendiente } = textoProximaAudiencia(proxima, hoy)
  let claseAviso = 'text-gray-500'
  if (pendiente) claseAviso = 'text-[#8a5a14]'
  else if (aviso === 'Hoy') claseAviso = 'text-brand-700'
  return (
    <>
      <Link
        to={RUTAS_JURIDICO.audienciasProceso(proceso.id, { audienciaId: proxima.id })}
        onClick={sinPropagar}
        className="whitespace-nowrap text-sm text-gray-900 tabular-nums hover:text-brand-700 hover:underline"
      >
        {formatFechaGT(proxima.fecha)} · {proxima.hora}
      </Link>
      <p className={`whitespace-nowrap text-xs font-medium ${claseAviso}`}>
        {pendiente && '● '}
        {aviso}
      </p>
    </>
  )
}

interface FilaProcesoProps {
  proceso: ProcesoResumen
  /** Fecha de hoy en Guatemala, una sola vez por lista. */
  hoy: string
  onAsignarNumero: () => void
  onAgendar: () => void
}

export default function FilaProceso({ proceso, hoy, onAsignarNumero, onAgendar }: FilaProcesoProps) {
  const alerta = textoAlerta(proceso)
  const navigate = useNavigate()
  const destino = RUTAS_JURIDICO.proceso(proceso.id)
  return (
    // Toda la fila abre el detalle; el enlace del código es el que recibe el foco del teclado.
    <tr onClick={() => navigate(destino)} className="group cursor-pointer border-t border-gray-100 hover:bg-gray-50">
      {/* Primera columna fija al desplazar la tabla: lleva su propio fondo. */}
      <td className="sticky left-0 z-10 bg-white px-4 py-3 align-top group-hover:bg-gray-50">
        <Link
          to={destino}
          onClick={sinPropagar}
          className="whitespace-nowrap font-mono text-[13px] font-medium text-brand-700 hover:underline"
        >
          {proceso.codigo}
        </Link>
        {proceso.esSeguimiento && (
          <div className="mt-1">
            <ChipSeguimiento fechaInicio={proceso.fechaInicio} />
          </div>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <p className="text-sm font-medium text-gray-900">{proceso.usuaria.nombreCompleto}</p>
      </td>
      <td className="px-4 py-3 align-top">
        <p className="text-sm text-gray-900">{ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo]}</p>
        <p className="text-xs text-gray-500">
          {ETIQUETAS_CATEGORIA_PROCESO[CATEGORIA_POR_TIPO_PROCESO[proceso.tipo]]} ·{' '}
          {proceso.abogada?.nombre ?? 'Sin abogada asignada'}
        </p>
      </td>
      <td className="px-4 py-3 align-top">
        {proceso.numeroJudicial ? (
          // Suele traer el juzgado o la fiscalía junto al número: se parte en líneas con un ancho
          // acotado y, si es muy largo, se recorta a 3 líneas (completo en el title y en el detalle).
          <p
            title={proceso.numeroJudicial}
            className="line-clamp-3 min-w-[200px] max-w-[260px] text-[13px] leading-snug break-words text-gray-900"
          >
            {proceso.numeroJudicial}
          </p>
        ) : (
          <BotonFila onClick={onAsignarNumero}>
            Agregar<span className="sr-only"> número judicial</span>
          </BotonFila>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <CeldaProximaAudiencia proceso={proceso} hoy={hoy} onAgendar={onAgendar} />
      </td>
      <td className="px-4 py-3 align-top">
        <BarraAvanceCompacta fase={proceso.fase} estado={proceso.estadoVisible} />
      </td>
      <td className="space-y-1 px-4 py-3 align-top">
        {/* La cabecera ya dice "Última actuación": aquí solo la fecha. */}
        <p className="whitespace-nowrap text-[13px] text-gray-700 tabular-nums">{fechaDeInstante(proceso.ultimaActuacionEn)}</p>
        {alerta && <p className="text-xs font-medium text-[#8a5a14]">● {alerta}</p>}
      </td>
    </tr>
  )
}
