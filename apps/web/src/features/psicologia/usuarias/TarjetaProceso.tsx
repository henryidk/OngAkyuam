import { Link } from 'react-router-dom'
import type { ProcesoPsicologiaResumen } from '@akyuam/shared'
import { fechaDeInstante } from '../../../lib/formato'
import EtiquetaEtapa from '../compartido/EtiquetaEtapa'
import { RUTAS_PSICOLOGIA } from '../rutas'
import { textoSesiones, textoSiguiente } from './textoProceso'
import CodigoProceso from '../compartido/CodigoProceso'

interface TarjetaProcesoProps {
  proceso: ProcesoPsicologiaResumen
  /** Nombre de la colega que lo llevó; sin él, el proceso es de quien mira. */
  psicologa?: string
}

/** Un proceso de la usuaria: lleva al detalle del proceso. */
export default function TarjetaProceso({ proceso, psicologa }: TarjetaProcesoProps) {
  return (
    <Link
      to={RUTAS_PSICOLOGIA.proceso(proceso.id)}
      className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 hover:border-brand-600"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <CodigoProceso codigo={proceso.codigo} className="text-gray-700" />
          <EtiquetaEtapa etapa={proceso.etapa} />
        </div>
        <p className="text-sm font-semibold text-gray-900">
          Proceso psicológico{psicologa !== undefined && ` · ${psicologa || 'otra psicóloga'}`}
        </p>
        <p className="text-xs text-gray-500 tabular-nums">
          Iniciado {fechaDeInstante(proceso.fechaInicio)} · {textoSesiones(proceso)} · {textoSiguiente(proceso)}
        </p>
      </div>
      <span className="text-sm font-medium text-brand-700">{psicologa === undefined ? 'Abrir →' : 'Leer →'}</span>
    </Link>
  )
}
