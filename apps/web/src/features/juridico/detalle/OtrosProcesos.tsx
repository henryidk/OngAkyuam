import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'
import {
  ETIQUETAS_ESTADO_VISIBLE,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  type ProcesoResumen,
} from '@akyuam/shared'
import { CLASES_BARRA } from '../compartido/colores'
import { RUTAS_JURIDICO } from '../rutas'
import { agruparOtrosProcesos } from './otrosProcesos'

/** Abiertos visibles antes de "Mostrar N más": el resto vive en la ficha de la usuaria. */
const ABIERTOS_VISIBLES = 5

const CLASE_TARJETA = 'rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]'

/**
 * Una fila de dos líneas: el tipo y, debajo, el No. interno. El estado solo se escribe cuando
 * aporta algo: dentro de "En curso" todos están en trámite salvo los suspendidos.
 */
function Fila({ proceso, conEstado }: { proceso: ProcesoResumen; conEstado: boolean }) {
  return (
    <li>
      <Link
        to={RUTAS_JURIDICO.proceso(proceso.id)}
        className="group block rounded-lg px-2 py-1.5 hover:bg-gray-50 focus-visible:bg-gray-50"
      >
        <span className="line-clamp-2 text-[13px] font-medium text-gray-900 group-hover:text-brand-700 group-hover:underline">
          {ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo]}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
          <span className="truncate font-mono">{proceso.codigo}</span>
          {conEstado && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex shrink-0 items-center gap-1">
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${CLASES_BARRA[proceso.estadoVisible]}`} />
                {ETIQUETAS_ESTADO_VISIBLE[proceso.estadoVisible]}
              </span>
            </>
          )}
        </span>
      </Link>
    </li>
  )
}

function BotonPlegable({
  abierto,
  onAlternar,
  children,
}: {
  abierto: boolean
  onAlternar: () => void
  children: ReactNode
}) {
  const Chevron = abierto ? ChevronDown : ChevronRight
  return (
    <button
      type="button"
      aria-expanded={abierto}
      onClick={onAlternar}
      className="mx-2 inline-flex items-center gap-1.5 rounded-md py-1 text-xs font-medium text-gray-600 hover:text-gray-900"
    >
      <Chevron size={13} aria-hidden="true" />
      {children}
    </button>
  )
}

/**
 * Contexto de los demás procesos de la usuaria, no su lista completa (esa está en su ficha):
 * los abiertos a la vista y los cerrados plegados, para que el panel no crezca sin fin.
 */
export default function OtrosProcesos({ procesos, usuariaId }: { procesos: ProcesoResumen[]; usuariaId: string }) {
  const [verTodosAbiertos, setVerTodosAbiertos] = useState(false)
  const [verCerrados, setVerCerrados] = useState(false)
  if (procesos.length === 0) return null

  const { abiertos, cerrados } = agruparOtrosProcesos(procesos)
  const abiertosVisibles = verTodosAbiertos ? abiertos : abiertos.slice(0, ABIERTOS_VISIBLES)
  const ocultos = abiertos.length - abiertosVisibles.length

  return (
    <section aria-labelledby="titulo-otros-procesos" className={`${CLASE_TARJETA} px-[18px] py-4`}>
      <h3 id="titulo-otros-procesos" className="text-sm font-semibold text-gray-900">
        Otros procesos de la usuaria <span className="font-medium text-gray-500 tabular-nums">{procesos.length}</span>
      </h3>

      {abiertos.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-medium text-gray-600">
            En curso <span className="tabular-nums text-gray-500">({abiertos.length})</span>
          </h4>
          <ul className="-mx-2 mt-1">
            {abiertosVisibles.map((proceso) => (
              <Fila key={proceso.id} proceso={proceso} conEstado={proceso.estadoVisible !== 'EN_TRAMITE'} />
            ))}
          </ul>
          {abiertos.length > ABIERTOS_VISIBLES && (
            <div className="-mx-2">
              <BotonPlegable abierto={verTodosAbiertos} onAlternar={() => setVerTodosAbiertos(!verTodosAbiertos)}>
                {verTodosAbiertos ? 'Mostrar menos' : `Mostrar ${ocultos} más`}
              </BotonPlegable>
            </div>
          )}
        </div>
      )}

      {cerrados.length > 0 && (
        <div className={`-mx-2 ${abiertos.length > 0 ? 'mt-2 border-t border-gray-100 pt-2' : 'mt-2'}`}>
          <BotonPlegable abierto={verCerrados} onAlternar={() => setVerCerrados(!verCerrados)}>
            {cerrados.length === 1 ? '1 proceso cerrado' : `${cerrados.length} procesos cerrados`}
          </BotonPlegable>
          {verCerrados && (
            <ul className="mt-1">
              {cerrados.map((proceso) => (
                <Fila key={proceso.id} proceso={proceso} conEstado />
              ))}
            </ul>
          )}
        </div>
      )}

      <Link
        to={RUTAS_JURIDICO.usuariaProcesos(usuariaId)}
        className="mt-3 inline-flex items-center gap-1 rounded text-[13px] font-semibold text-brand-700 hover:underline"
      >
        Ver en la ficha de la usuaria
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </section>
  )
}
