import { Link } from 'react-router-dom'
import {
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  type ProcesoResumen,
  type RegistroContextoDto,
  type TipoProcesoJuridico,
} from '@akyuam/shared'
import EtiquetaEstado from '../compartido/EtiquetaEstado'
import { fechaDeInstante } from '../compartido/formato'
import { RUTAS_JURIDICO } from '../rutas'

interface ResumenLateralProps {
  contexto: RegistroContextoDto
  seleccionados: TipoProcesoJuridico[]
}

const CLASE_PANEL = 'rounded-xl border border-gray-200 bg-white p-4'
const CLASE_TITULO = 'text-[11px] font-semibold uppercase tracking-wide text-gray-500'

function FilaHistorial({ proceso }: { proceso: ProcesoResumen }) {
  return (
    <li>
      <Link to={RUTAS_JURIDICO.proceso(proceso.id)} target="_blank" rel="noreferrer" className="block hover:underline">
        <span className="font-mono text-xs text-gray-600">{proceso.codigo}</span>{' '}
        <span className="text-sm text-gray-900">{ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo]}</span>
      </Link>
      <EtiquetaEstado estado={proceso.estadoVisible} />
    </li>
  )
}

/** Columna derecha del asistente: lo que se va a crear y lo que la usuaria ya tiene. */
export default function ResumenLateral({ contexto, seleccionados }: ResumenLateralProps) {
  const { referencia, historial } = contexto
  return (
    <aside className="space-y-4">
      <section className={CLASE_PANEL}>
        <h3 className={CLASE_TITULO}>Procesos a registrar</h3>
        {seleccionados.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Aún no ha seleccionado ninguno.</p>
        ) : (
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-gray-800">
            {seleccionados.map((tipo) => (
              <li key={tipo}>{ETIQUETAS_TIPO_PROCESO_JURIDICO[tipo]}</li>
            ))}
          </ol>
        )}
      </section>

      {referencia && (
        <section className={CLASE_PANEL}>
          <h3 className={CLASE_TITULO}>Referencia de Trabajo Social</h3>
          <p className="mt-2 text-xs text-gray-500">
            {fechaDeInstante(referencia.referidoEn)} · {referencia.referidoPor}
          </p>
          <p className="mt-1 text-sm text-gray-800">{referencia.motivo || 'Sin motivo registrado.'}</p>
        </section>
      )}

      <section className={CLASE_PANEL}>
        <h3 className={CLASE_TITULO}>Historial de la usuaria</h3>
        {historial.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Sin procesos anteriores.</p>
        ) : (
          <ul className="mt-2 space-y-2.5">
            {historial.map((proceso) => (
              <FilaHistorial key={proceso.id} proceso={proceso} />
            ))}
          </ul>
        )}
      </section>
    </aside>
  )
}
