import { Link } from 'react-router-dom'
import {
  ETIQUETAS_FORMA_FINALIZACION,
  FORMAS_FINALIZACION_PROCESO,
  type ResumenProcesos,
} from '@akyuam/shared'
import { CLASES_FORMA } from '../compartido/colores'
import { RUTAS_JURIDICO } from '../rutas'

const CLASE_TARJETA = 'flex flex-col rounded-xl border border-gray-200 bg-white p-4 text-left hover:border-brand-300'
const CLASE_TITULO = 'text-xs font-semibold uppercase tracking-wide text-gray-500'
const CLASE_NUMERO = 'mt-1 text-3xl font-semibold tabular-nums text-gray-900'
const CLASE_PIE = 'mt-1 text-xs text-gray-500'

/** Cuatro totales que además son atajos a la lista ya filtrada. */
export default function TarjetasResumen({ resumen }: { resumen: ResumenProcesos }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Link to={RUTAS_JURIDICO.bandeja()} className={CLASE_TARJETA}>
        <span className={CLASE_TITULO}>Pendientes de iniciar</span>
        <span className={CLASE_NUMERO}>{resumen.referenciasPendientes}</span>
        <span className={CLASE_PIE}>referencias · {resumen.procesosSugeridos} procesos sugeridos por TS →</span>
      </Link>

      <Link to={RUTAS_JURIDICO.procesos({ estado: 'INICIADOS' })} className={CLASE_TARJETA}>
        <span className={CLASE_TITULO}>Iniciados</span>
        <span className={CLASE_NUMERO}>{resumen.enTramite + resumen.suspendidos}</span>
        <span className={CLASE_PIE}>
          {resumen.enTramite} en trámite · {resumen.suspendidos} suspendidos
        </span>
      </Link>

      <div className={`${CLASE_TARJETA} hover:border-gray-200`}>
        <Link to={RUTAS_JURIDICO.procesos({ estado: 'FINALIZADO' })} className="hover:underline">
          <span className={CLASE_TITULO}>Finalizados</span>
          <span className={`${CLASE_NUMERO} block`}>{resumen.finalizados}</span>
        </Link>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FORMAS_FINALIZACION_PROCESO.map((forma) => (
            <Link
              key={forma}
              to={RUTAS_JURIDICO.procesos({ estado: 'FINALIZADO', forma })}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium hover:opacity-80 ${CLASES_FORMA[forma]}`}
            >
              {ETIQUETAS_FORMA_FINALIZACION[forma]} <span className="tabular-nums">{resumen.finalizadosPorForma[forma]}</span>
            </Link>
          ))}
        </div>
      </div>

      <Link to={RUTAS_JURIDICO.procesos({ estado: 'ABANDONADO' })} className={CLASE_TARJETA}>
        <span className={CLASE_TITULO}>Abandonados</span>
        <span className={CLASE_NUMERO}>{resumen.abandonados}</span>
        <span className={CLASE_PIE}>pueden reactivarse</span>
      </Link>
    </div>
  )
}
