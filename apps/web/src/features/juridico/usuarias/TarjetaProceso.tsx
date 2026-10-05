import { Link } from 'react-router-dom'
import { ETIQUETAS_TIPO_PROCESO_JURIDICO, formatFechaGT, type ProcesoResumen } from '@akyuam/shared'
import { BarraAvanceCompacta } from '../compartido/BarraAvance'
import EtiquetaEstado from '../compartido/EtiquetaEstado'
import EtiquetaForma from '../compartido/EtiquetaForma'
import { fechaDeReferencia, textoAlerta } from '../compartido/formato'
import { RUTAS_JURIDICO } from '../rutas'

/** Un proceso de la usuaria: lleva al detalle del proceso. */
export default function TarjetaProceso({ proceso }: { proceso: ProcesoResumen }) {
  const alerta = textoAlerta(proceso)
  return (
    <Link
      to={RUTAS_JURIDICO.proceso(proceso.id)}
      className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 hover:border-brand-600"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[13px] font-medium text-gray-700">{proceso.codigo}</span>
          <EtiquetaEstado estado={proceso.estadoVisible} />
          {proceso.formaFinalizacion && <EtiquetaForma forma={proceso.formaFinalizacion} />}
        </div>
        <p className="text-sm font-semibold text-gray-900">{ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo]}</p>
        <p className="text-xs text-gray-500 tabular-nums">
          Iniciado {formatFechaGT(proceso.fechaInicio)} · {fechaDeReferencia(proceso)} ·{' '}
          {proceso.abogada?.nombre ?? 'Sin abogada asignada'}
        </p>
      </div>
      <div className="space-y-1">
        <BarraAvanceCompacta fase={proceso.fase} estado={proceso.estadoVisible} />
        {alerta && <p className="text-xs font-medium text-[#8a5a14]">● {alerta}</p>}
      </div>
      <span className="text-sm font-medium text-brand-700">Abrir →</span>
    </Link>
  )
}
