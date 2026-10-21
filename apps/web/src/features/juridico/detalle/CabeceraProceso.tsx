import { Link } from 'react-router-dom'
import { Pencil, Plus } from 'lucide-react'
import {
  CATEGORIA_POR_TIPO_PROCESO,
  ETIQUETAS_CATEGORIA_PROCESO,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  formatFechaGT,
  type ProcesoDetalle,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import Tabs from '../../../components/ui/Tabs'
import EtiquetaEstadoAudiencia from '../audiencias/EtiquetaEstadoAudiencia'
import BarraAvance from '../compartido/BarraAvance'
import ChipSeguimiento from '../compartido/ChipSeguimiento'
import EtiquetaEstado from '../compartido/EtiquetaEstado'
import { RUTAS_JURIDICO } from '../rutas'

interface CabeceraProcesoProps {
  proceso: ProcesoDetalle
  /** `null` si el proceso ya está cerrado y no admite audiencias. */
  onAgendar: (() => void) | null
  onActuacion: () => void
  onReactivar: () => void
  /** Abre el modal para agregar o corregir el No. judicial. */
  onNumeroJudicial: () => void
}

/** El No. judicial va junto al No. interno: sin él, el botón para agregarlo es lo primero que se ve. */
function NumeroJudicial({ numero, onEditar }: { numero: string | null; onEditar: () => void }) {
  if (!numero) {
    return (
      <button
        type="button"
        onClick={onEditar}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-brand-600 px-2.5 py-0.5 text-[11px] font-medium text-brand-700 hover:bg-brand-50"
      >
        <Plus size={12} aria-hidden="true" />
        Agregar No. judicial
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
      <span className="text-gray-400" aria-hidden="true">
        ·
      </span>
      <span className="text-xs text-gray-500">No. judicial</span>
      <span className="break-all font-mono font-medium">{numero}</span>
      <button
        type="button"
        onClick={onEditar}
        aria-label="Corregir No. judicial"
        title="Corregir No. judicial"
        className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-brand-700"
      >
        <Pencil size={13} aria-hidden="true" />
      </button>
    </span>
  )
}

function ProximaAudiencia({ proceso }: { proceso: ProcesoDetalle }) {
  const proxima = proceso.proximaAudiencia
  if (!proxima) return <p className="text-[13px] text-gray-500">Sin audiencias programadas</p>
  return (
    <p className="flex flex-wrap items-center gap-2 text-[13px] text-gray-700">
      <span>Próxima audiencia:</span>
      <Link
        to={RUTAS_JURIDICO.audienciasProceso(proceso.id, { audienciaId: proxima.id })}
        className="font-medium text-brand-700 tabular-nums hover:underline"
      >
        {formatFechaGT(proxima.fecha)} {proxima.hora}
      </Link>
      {proxima.estadoVisible !== 'PROXIMA' && <EtiquetaEstadoAudiencia estado={proxima.estadoVisible} />}
    </p>
  )
}

export default function CabeceraProceso({
  proceso,
  onAgendar,
  onActuacion,
  onReactivar,
  onNumeroJudicial,
}: CabeceraProcesoProps) {
  const documentos = proceso.carpetas.reduce((total, carpeta) => total + carpeta.documentos.length, 0)
  return (
    <header className="rounded-xl border border-gray-200 bg-white px-6 pt-5 shadow-[0_1px_2px_rgba(16,24,40,.04)]">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-[260px] flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium text-gray-700">{proceso.codigo}</span>
            <NumeroJudicial numero={proceso.numeroJudicial} onEditar={onNumeroJudicial} />
            <EtiquetaEstado estado={proceso.estadoVisible} />
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
              {ETIQUETAS_CATEGORIA_PROCESO[CATEGORIA_POR_TIPO_PROCESO[proceso.tipo]]}
            </span>
            {proceso.esSeguimiento && <ChipSeguimiento fechaInicio={proceso.fechaInicio} />}
          </div>
          <h2 className="text-[22px] font-semibold tracking-tight text-pretty text-gray-900">
            {ETIQUETAS_TIPO_PROCESO_JURIDICO[proceso.tipo]}
          </h2>
          <p className="text-sm text-gray-600">
            <Link to={RUTAS_JURIDICO.usuaria(proceso.usuaria.id)} className="font-medium text-brand-700 hover:underline">
              {proceso.usuaria.nombreCompleto}
            </Link>{' '}
            · Expediente {proceso.expedienteNumero}
          </p>
          {onAgendar && <ProximaAudiencia proceso={proceso} />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variante="secondary" tamano="md" onClick={onActuacion}>
            Registrar actuación
          </Button>
          {onAgendar && (
            <Button variante="secondary" tamano="md" onClick={onAgendar}>
              Agendar audiencia
            </Button>
          )}
          {proceso.accionesDisponibles.includes('REACTIVAR') && (
            <Button tamano="md" onClick={onReactivar}>
              Reactivar proceso
            </Button>
          )}
        </div>
      </div>
      <div className="mt-5">
        <BarraAvance fase={proceso.fase} estado={proceso.estadoVisible} />
      </div>
      <Tabs
        className="mt-4"
        items={[
          { to: RUTAS_JURIDICO.proceso(proceso.id), etiqueta: `Bitácora (${proceso.bitacora.length})`, fin: true },
          { to: RUTAS_JURIDICO.documentosProceso(proceso.id), etiqueta: `Documentos (${documentos})` },
          { to: RUTAS_JURIDICO.audienciasProceso(proceso.id), etiqueta: 'Audiencias' },
        ]}
      />
    </header>
  )
}
