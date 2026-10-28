import { Link } from 'react-router-dom'
import { Pencil, Plus } from 'lucide-react'
import {
  CATEGORIA_POR_TIPO_PROCESO,
  ETIQUETAS_CATEGORIA_PROCESO,
  ETIQUETAS_TIPO_PROCESO_JURIDICO,
  formatFechaGT,
  type AccionProceso,
  type ProcesoDetalle,
} from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import Tabs from '../../../components/ui/Tabs'
import MenuAcciones, { type OpcionMenu } from '../audiencias/MenuAcciones'
import BarraAvance from '../compartido/BarraAvance'
import ChipSeguimiento from '../compartido/ChipSeguimiento'
import EtiquetaEstado from '../compartido/EtiquetaEstado'
import { RUTAS_JURIDICO } from '../rutas'
import { textoDiaRelativo } from './formatoBitacora'

interface CabeceraProcesoProps {
  proceso: ProcesoDetalle
  /** `null` si el proceso ya está cerrado y no admite audiencias. */
  onAgendar: (() => void) | null
  onActuacion: () => void
  /** Abre el modal para agregar o corregir el No. judicial. */
  onNumeroJudicial: () => void
  onFinalizar: () => void
  onSuspender: () => void
  onAbandonar: () => void
}

/** Sin No. judicial, el botón para agregarlo va junto al No. interno; ya capturado, va en su propia línea. */
function NumeroJudicial({ numero, onEditar }: { numero: string | null; onEditar: () => void }) {
  if (!numero) {
    return (
      <button
        type="button"
        onClick={onEditar}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-brand-600 px-2.5 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
      >
        <Plus size={12} aria-hidden="true" />
        Agregar No. judicial
      </button>
    )
  }
  // Suele traer el juzgado o la fiscalía junto al número: va en su propia línea y se parte si no cabe.
  return (
    <p className="flex items-start gap-2 text-sm">
      <span className="whitespace-nowrap text-gray-500">No. judicial</span>
      <span className="min-w-0 break-words text-gray-900">{numero}</span>
      <button
        type="button"
        onClick={onEditar}
        aria-label="Corregir No. judicial"
        title="Corregir No. judicial"
        className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-brand-700"
      >
        <Pencil size={13} aria-hidden="true" />
      </button>
    </p>
  )
}

/** "Inició el 21/10/2026 · última actuación hoy" o, ya cerrado, "· finalizó el 23/10/2026". */
function textoTrayectoria(proceso: ProcesoDetalle): string {
  const inicio = `Inició el ${formatFechaGT(proceso.fechaInicio)}`
  if (proceso.estadoVisible === 'FINALIZADO' && proceso.fechaCierre) {
    return `${inicio} · finalizó el ${formatFechaGT(proceso.fechaCierre)}`
  }
  return `${inicio} · última actuación ${textoDiaRelativo(proceso.ultimaActuacionEn)}`
}

/** Cerrar o pausar va en el menú: es poco frecuente y no debe competir con el trabajo diario. */
function opcionesCierre(
  acciones: AccionProceso[],
  { onFinalizar, onSuspender, onAbandonar }: Pick<CabeceraProcesoProps, 'onFinalizar' | 'onSuspender' | 'onAbandonar'>,
): OpcionMenu[] {
  const opciones: (OpcionMenu & { accion: AccionProceso })[] = [
    {
      accion: 'FINALIZAR',
      clave: 'finalizar',
      etiqueta: 'Finalizar proceso',
      detalle: 'Convenio, sentencia, desistimiento u otra forma',
      onElegir: onFinalizar,
    },
    {
      accion: 'SUSPENDER',
      clave: 'suspender',
      etiqueta: 'Suspender temporalmente',
      detalle: 'Queda en pausa y puede retomarse',
      onElegir: onSuspender,
    },
    {
      accion: 'ABANDONAR',
      clave: 'abandonar',
      etiqueta: 'Registrar abandono del caso',
      detalle: 'La usuaria dejó de dar seguimiento',
      tono: 'aviso',
      onElegir: onAbandonar,
    },
  ]
  // Solo lo que la máquina de estados del backend permite ahora (`accionesDisponibles`).
  return opciones.filter((opcion) => acciones.includes(opcion.accion))
}

export default function CabeceraProceso({
  proceso,
  onAgendar,
  onActuacion,
  onNumeroJudicial,
  ...cierre
}: CabeceraProcesoProps) {
  const documentos = proceso.carpetas.reduce((total, carpeta) => total + carpeta.documentos.length, 0)
  const actuaciones = proceso.bitacora.filter((entrada) => !entrada.esSistema).length
  const menu = opcionesCierre(proceso.accionesDisponibles, cierre)

  return (
    <header className="rounded-xl border border-gray-200 bg-white px-4 pt-5 shadow-[0_1px_2px_rgba(16,24,40,.04)] sm:px-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1 basis-[300px] space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-gray-700">{proceso.codigo}</span>
            {!proceso.numeroJudicial && <NumeroJudicial numero={null} onEditar={onNumeroJudicial} />}
            <EtiquetaEstado estado={proceso.estadoVisible} />
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
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
          {proceso.numeroJudicial && <NumeroJudicial numero={proceso.numeroJudicial} onEditar={onNumeroJudicial} />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onAgendar && (
            <Button variante="secondary" tamano="md" onClick={onAgendar}>
              Agendar audiencia
            </Button>
          )}
          <Button tamano="md" onClick={onActuacion}>
            Registrar actuación
          </Button>
          {menu.length > 0 && <MenuAcciones opciones={menu} etiqueta="Más acciones del proceso" boton="borde" />}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <BarraAvance fase={proceso.fase} estado={proceso.estadoVisible} />
        <p className="text-[13px] text-gray-500 tabular-nums">{textoTrayectoria(proceso)}</p>
      </div>

      <Tabs
        className="-mx-4 mt-4 border-t border-gray-100 px-2 sm:-mx-6 sm:px-3"
        items={[
          { to: RUTAS_JURIDICO.proceso(proceso.id), etiqueta: 'Bitácora', conteo: actuaciones, fin: true },
          { to: RUTAS_JURIDICO.audienciasProceso(proceso.id), etiqueta: 'Audiencias' },
          { to: RUTAS_JURIDICO.documentosProceso(proceso.id), etiqueta: 'Documentos', conteo: documentos },
        ]}
      />
    </header>
  )
}
